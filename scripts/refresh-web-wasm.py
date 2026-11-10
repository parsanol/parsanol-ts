#!/usr/bin/env python3
"""Vendor an exact official @parsanol/wasm web build; no Rust rebuild needed."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ['parsanol.js', 'parsanol.d.ts', 'parsanol_bg.wasm', 'parsanol_bg.wasm.d.ts', 'README.md']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('version', help='exact @parsanol/wasm version matching the Node engine')
    args = parser.parse_args()
    if not re.fullmatch(r'\d+\.\d+\.\d+', args.version):
        raise ValueError('an exact released version is required')
    target = ROOT / 'vendor/parsanol-web'
    target.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='parsanol-web-vendor-') as temporary:
        result = subprocess.run(['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary,
                                 '@parsanol/wasm@' + args.version], check=True, text=True, capture_output=True)
        receipt = json.loads(result.stdout)[0]
        archive = Path(temporary) / receipt['filename']
        with tarfile.open(archive) as tar:
            metadata = json.load(tar.extractfile('package/package.json'))
            if metadata['version'] != args.version or metadata['type'] != 'module':
                raise ValueError('expected the exact official web-target ESM package')
            for filename in FILES:
                (target / filename).write_bytes(tar.extractfile('package/' + filename).read())
        provenance = {
            'package': '@parsanol/wasm', 'version': args.version, 'target': 'web',
            'repository': 'https://github.com/parsanol/parsanol-rs',
            'tarball': f'https://registry.npmjs.org/@parsanol/wasm/-/wasm-{args.version}.tgz',
            'integrity': receipt['integrity'], 'tarball_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
            'files': {name: hashlib.sha256((target / name).read_bytes()).hexdigest() for name in FILES},
        }
        # Keep the upstream MIT notice next to the generated browser bindings.
        if (target / 'LICENSE').exists():
            provenance['files']['LICENSE'] = hashlib.sha256((target / 'LICENSE').read_bytes()).hexdigest()
        (target / 'BUILT_FROM.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')
    print(f'vendored official @parsanol/wasm@{args.version} web build')

if __name__ == '__main__':
    main()
