#!/usr/bin/env python3
"""Vendor an exact @parsanol/wasm web build; no Rust rebuild needed.

With a version, the official registry release is packed. With --tarball and
--sha256, a tested CI build of the same package (parsanol-rs WASM workflow,
`parsanol-wasm-ci/v1` provenance) is vendored after its digest is checked.
"""
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
    parser.add_argument('version', nargs='?', help='exact released @parsanol/wasm version')
    parser.add_argument('--tarball', type=Path, help='tested CI npm tarball of @parsanol/wasm')
    parser.add_argument('--sha256', help='expected SHA-256 of --tarball')
    parser.add_argument('--artifact-url', help='workflow artifact the tarball was downloaded from')
    args = parser.parse_args()
    target = ROOT / 'vendor/parsanol-web'
    target.mkdir(parents=True, exist_ok=True)
    if args.tarball is not None:
        return vendor_ci(args, target)
    if args.version is None or not re.fullmatch(r'\d+\.\d+\.\d+', args.version):
        raise ValueError('an exact released version is required')
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
            'package': '@parsanol/wasm', 'version': args.version, 'crate_version': args.version, 'target': 'web',
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

def vendor_ci(args, target):
    data = args.tarball.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if args.sha256 is None or digest != args.sha256.lower():
        raise ValueError(f'tarball SHA-256 {digest} does not match --sha256')
    with tarfile.open(args.tarball) as tar:
        metadata = json.load(tar.extractfile('package/package.json'))
        built = json.load(tar.extractfile('package/build-provenance.json'))
        sums = dict(reversed(line.split(None, 1)) for line in
                    tar.extractfile('package/SHA256SUMS').read().decode().splitlines() if line.strip())
        if metadata['name'] != '@parsanol/wasm' or metadata['type'] != 'module':
            raise ValueError('expected the @parsanol/wasm web-target ESM package')
        if built.get('schema') != 'parsanol-wasm-ci/v1' or built.get('bindgen_target') != 'web' or not built.get('tracked_worktree_clean'):
            raise ValueError('expected clean parsanol-wasm-ci/v1 web-target provenance')
        for filename in FILES + ['LICENSE']:
            body = tar.extractfile('package/' + filename).read()
            if hashlib.sha256(body).hexdigest() != sums.get(filename):
                raise ValueError(f'{filename} does not match the package SHA256SUMS')
            (target / filename).write_bytes(body)
    provenance = {
        'package': '@parsanol/wasm', 'version': metadata['version'], 'target': 'web',
        'kind': built['kind'], 'repository': built['repository'],
        'source_commit': built['source_head_sha'], 'built_source_commit': built['checkout_build_sha'],
        'workflow': built['workflow'], 'run_id': built['run_id'], 'run_attempt': built['run_attempt'],
        'artifact': args.artifact_url, 'tarball': args.tarball.name, 'tarball_sha256': digest,
        'cargo_lock_sha256': built['cargo_lock_sha256'], 'profile': built['profile'],
        'versions': built['versions'],
        'files': {name: hashlib.sha256((target / name).read_bytes()).hexdigest() for name in FILES + ['LICENSE']},
    }
    (target / 'BUILT_FROM.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')
    print(f"vendored tested @parsanol/wasm@{metadata['version']} web build from {built['source_head_sha'][:12]}")


if __name__ == '__main__':
    main()
