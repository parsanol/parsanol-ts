#!/usr/bin/env python3
"""Reproduce the two vendored candidate bindings from one pinned Rust WASM build.
Requires a local Rust compiler/wasm32 standard library and wasm-bindgen0.2.130.
No compiler/target/CLI installation or source checkout is performed here.
"""
from pathlib import Path
import argparse,hashlib,json,os,shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--bindgen',type=Path,required=True);parser.add_argument('--target-dir',type=Path,required=True);parser.add_argument('--cargo',default='cargo');parser.add_argument('--sysroot',type=Path);args=parser.parse_args()
receipt=json.loads((ROOT/'vendor/parsanol-web/BUILT_FROM.json').read_text());source=args.source.resolve();head=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
if head!=receipt['source_commit']:raise SystemExit('source checkout does not match pinned engine commit')
if subprocess.check_output(['git','-C',str(source),'status','--porcelain'],text=True):raise SystemExit('engine source checkout must be clean')
if subprocess.check_output([str(args.bindgen),'--version'],text=True).strip()!='wasm-bindgen 0.2.130':raise SystemExit('wasm-bindgen0.2.130 required')
lock=ROOT/'scripts/wasm-build/Cargo.lock'
if hashlib.sha256(lock.read_bytes()).hexdigest()!=receipt['lockfile_sha256']:raise SystemExit('engine dependency lock checksum mismatch')
env=os.environ.copy();env['CARGO_TARGET_DIR']=str(args.target_dir.resolve())
if args.sysroot:env['CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS']='--sysroot='+str(args.sysroot.resolve())
with tempfile.TemporaryDirectory(prefix='parsanol-engine-build-')as temporary:
 temporary=Path(temporary);(temporary/'src').mkdir();(temporary/'src/lib.rs').write_text('pub use parsanol::*;\n')
 (temporary/'Cargo.toml').write_text('[package]\nname="stage-compatibility-wasm-probe"\nversion="0.1.0"\nedition="2021"\n[workspace]\n[dependencies]\nparsanol={path='+json.dumps(str(source/'parsanol'))+',features=["wasm"]}\nserde_json={version="1.0",features=["preserve_order","arbitrary_precision"]}\n')
 shutil.copyfile(lock,temporary/'Cargo.lock')
 subprocess.run([args.cargo,'build','--locked','--manifest-path',str(temporary/'Cargo.toml'),'-p','parsanol','--lib','--target','wasm32-unknown-unknown'],env=env,check=True)
 wasm=args.target_dir.resolve()/'wasm32-unknown-unknown/debug/parsanol.wasm'
 for target,directory in [('web','parsanol-web'),('nodejs','parsanol-wasm')]:
  output=temporary/target;subprocess.run([str(args.bindgen),str(wasm),'--target',target,'--out-dir',str(output)],check=True);dest=ROOT/'vendor'/directory
  for name in ['parsanol.js','parsanol_bg.wasm','parsanol_bg.wasm.d.ts','parsanol.d.ts']:shutil.copyfile(output/name,dest/('parsanol.cjs'if target=='nodejs'and name=='parsanol.js'else name))
  data=json.loads((dest/'BUILT_FROM.json').read_text());data.update(built_source_commit=head,built_source_tree_equal=True,files={f.name:hashlib.sha256(f.read_bytes()).hexdigest()for f in dest.iterdir()if f.name not in ['BUILT_FROM','BUILT_FROM.json']});(dest/'BUILT_FROM.json').write_text(json.dumps(data,indent=2)+'\n')
print('built both bindings from '+head)
