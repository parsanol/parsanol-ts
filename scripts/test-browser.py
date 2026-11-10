#!/usr/bin/env python3
"""Exercise the packed public browser entry in a real headless Chrome process."""
from pathlib import Path
import argparse
import hashlib
import html
import http.server
import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
SOURCE = '\n      grammar Demo version "1.0.0" {\n        pair = ( 1*( %x61-7A / %x30-39 ) ) as k "=" ( 1*( %x30-39 ) ) as v ";"\n        document = 1*( pair )\n        entry main: document\n        test { accept "a=1;b=2;" }\n      }\n    '

PAGE = '''<!doctype html><meta charset="utf-8"><body>pending<script type="module">
import initialize, { PargRuntime, compileSource } from "/dist/browser.js";
const checks=[];
const assert=(condition,name)=>{ if(!condition)throw Error(name); checks.push(name); };
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
try {
  const fixture=await(await fetch('/fixture.json')).json();
  let notReady=false;
  try { new PargRuntime(JSON.stringify(fixture.artifact)); } catch(error) {notReady=String(error).includes('initialize');}
  assert(notReady,'explicit initialization boundary');
  await Promise.all([initialize(),initialize()]);
  const compiled=compileSource(fixture.source);
  assert(equal(compiled,fixture.artifact),'browser compiler agrees with Node artifact');
  const canonicalPolicy=value=>Array.isArray(value)?value.map(canonicalPolicy):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalPolicy(value[key])])):value;
  for(const [prefix,input,causal]of [['a','ab?',1],['α','αb?',2]]){
    const envelope={shape:'parsanol-tree/v2',grammar:'DiagnosticPolicy',version:'1.0.0',default_entry:'main',entries:{main:{root:'main',grammar:{root:6,atoms:[{Str:{pattern:prefix+'b'}},{Str:{pattern:'c'}},{Sequence:{atoms:[0,1]}},{Lookahead:{atom:2,positive:false}},{Str:{pattern:prefix}},{Str:{pattern:'!'}},{Sequence:{atoms:[3,4,5]}}]}}}};
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonicalPolicy(envelope))));
    envelope.checksum='sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    const policyRuntime=new PargRuntime(JSON.stringify(envelope));
    try{
      for(const [mode,offset]of [['strict',causal+1],['parslet',causal]]){
        const result=policyRuntime.parseShapeWithCompatibility(input,mode);
        assert(result.ok===false&&result.error.offset===offset,'browser policy '+prefix+' '+mode);
      }
      assert(policyRuntime.parseShapeRecovering(input).error.offset===causal+1,'browser old strict policy '+prefix);
      assert(policyRuntime.parseShapeWithCompatibility(prefix+'!','parslet').ok,'browser policy accepts '+prefix);
      let unknown=false;try{policyRuntime.parseShapeWithCompatibility(input,'unknown');}catch{unknown=true;}
      assert(unknown,'browser unknown policy '+prefix);
    }finally{policyRuntime.artifact.free();}
  }

  const runtime=new PargRuntime(JSON.stringify(compiled));
  assert(equal(runtime.parseShape('a=1;b=2;'),fixture.shape),'native browser parse shape agrees with Node');
  assert(equal(runtime.applyBindings(runtime.parseShape('a=1;b=2;')),fixture.bound),'browser bindings agree with Node');
  assert(runtime.runTests().length===0,'embedded artifact tests run in browser');
  assert(await runtime.compiledFrom(fixture.source),'browser SHA256 source match');
  assert(!await runtime.compiledFrom(fixture.source+' '),'browser SHA256 source mismatch');
  const recovery=runtime.parseShapeRecovering('a=;');
  assert(recovery.ok===false && typeof recovery.error.offset==='number','native recovery failure offset');
  let rejected=false; try {runtime.parseShape('a=;');} catch {rejected=true;}
  assert(rejected,'invalid input rejected');
  let tampered=false; try {new PargRuntime(JSON.stringify({...compiled,checksum:'sha256:'+'0'.repeat(64)}));} catch(error){tampered=/checksum/i.test(String(error));}
  assert(tampered,'tampered artifact rejected');
  const fetched=await PargRuntime.fromURL('/artifact.json');
  assert(equal(fetched.parseShape('a=1;b=2;'),fixture.shape),'HTTP artifact load and parse');
  fetched.artifact.free();
  let missing=false; try {await PargRuntime.fromURL('/missing-artifact.json');} catch(error){missing=String(error).includes('404');}
  assert(missing,'HTTP artifact failure propagated');
  if(fixture.external){
    if(fixture.external.stageModule){
      const adapter=await import('/external-stage/browser.js');
      const stage=await adapter.createParser(fixture.external.bundle,(artifact,entry)=>new PargRuntime(artifact,entry));
      for(const row of fixture.external.stageCases){
        if(row.error){
          let failure;try{stage.parse(row.input);}catch(error){failure=error;}
          assert(failure?.name===row.error.name && failure?.byteOffset===row.error.byteOffset,'stage refusal '+row.input);
        }else{
          assert(equal(stage.parseShape(row.input),row.shape),'stage shape '+row.input);
          assert(equal(stage.parseBindings(row.input),row.bindings),'stage declared bindings '+row.input);
          assert(equal(stage.parseTree(row.input),row.tree),'stage legacy tree '+row.input);
          const document=stage.parse(row.input);
          assert(document.constructor.name===row.modelClass && equal(JSON.parse(JSON.stringify(document)),row.model),'stage generated typed model '+row.input);
          if(row.input==='alpha+1'){
            const pending=[JSON.parse(JSON.stringify(document))];let alpha=false;
            while(pending.length){const node=pending.pop();if(node&&typeof node==='object'){if(node.spelling==='alpha'&&node.value==='α')alpha=true;pending.push(...Object.values(node));}}
            assert(alpha,'stage alpha resolves to Greek Unicode symbol');
          }
        }
      }
    }else{
    const external=new PargRuntime(fixture.external.artifactText,fixture.external.entry);
    for(const row of fixture.external.cases){
      const shape=external.parseShape(row.input);
      assert(equal(shape,row.shape),'external stage shape '+row.input);
      if(fixture.external.bindingsText){
        assert(equal(external.applyBindingsArtifact(fixture.external.bindingsText,shape),row.bound),'external declared bindings '+row.input);
      }
    }
    external.artifact.free();
    }
  }
  runtime.artifact.free();
  document.body.textContent=JSON.stringify({ok:true,checks,compiler_version:compiled.compiler_version,recovery});
}catch(error){document.body.textContent=JSON.stringify({ok:false,checks,error:String(error),stack:error.stack});}
</script>'''
NODE_FIXTURE = '''
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
const runtime=await import(pathToFileURL(process.argv[1]).href);
const source=readFileSync(process.argv[2],'utf8');
const artifact=runtime.compileSource(source);
const parser=new runtime.PargRuntime(JSON.stringify(artifact));
const shape=parser.parseShape('a=1;b=2;');
const result={source,artifact,shape,bound:parser.applyBindings(shape)};
if(process.argv[3]){
 const config=JSON.parse(readFileSync(process.argv[3],'utf8'));
 const artifactText=readFileSync(config.artifact,'utf8');
 const bindingsText=config.bindings?readFileSync(config.bindings,'utf8'):null;
 if(config.stage_module){
   const stage=await import(pathToFileURL(config.stage_module).href);
   await stage.initialize();
   const bundle={artifact:artifactText,bindings:bindingsText,wrappers:readFileSync(config.wrappers,'utf8')};
   const stageCases=config.inputs.map(input=>{
     try{
       const model=stage.parse(input);
       if((config.reject||[]).includes(input))throw Error('expected stage rejection');
       if(config.model_class && model.constructor.name!==config.model_class)throw Error('expected generated model class');
       return {input,shape:stage.parseShape(input),bindings:stage.parseBindings(input),tree:stage.parseTree(input),model,modelClass:model.constructor.name};
     }catch(error){if(!(config.reject||[]).includes(input))throw error;return {input,error:{name:error.name,byteOffset:error.byteOffset}};}
   });
   result.external={stageModule:true,bundle,stageCases};
 }else{
   const stage=new runtime.PargRuntime(artifactText,config.entry);
   result.external={artifactText,bindingsText,entry:config.entry,cases:config.inputs.map(input=>{
     const shape=stage.parseShape(input);
     return {input,shape,bound:bindingsText?stage.applyBindingsArtifact(bindingsText,shape):null};
   })};
   stage.artifact.free();
 }
}
parser.artifact.free(); console.log(JSON.stringify(result));
'''


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--node',default=os.environ.get('NODE_BIN','node'),help='Node >=22 executable used for the Node reference')
    parser.add_argument('--external-fixture',help='optional JSON with existing artifact/bindings/entry/inputs for stage integration')
    args=parser.parse_args()
    node_version=subprocess.check_output([args.node,'--version'],text=True).strip()
    if int(node_version.lstrip('v').split('.')[0])<22:raise RuntimeError('the Node reference requires Node >=22')
    browser=os.environ.get('CHROME_BIN') or shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
    if not browser:raise RuntimeError('real Chrome/Chromium required; no browser test is skipped')
    output=Path(os.environ.get('BROWSER_EVIDENCE_DIR',str(ROOT/'.browser-evidence')))
    output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='parsanol-browser-') as temporary:
        temporary=Path(temporary)
        packed=subprocess.run(['npm','pack','--json','--pack-destination',str(temporary)],cwd=ROOT,text=True,capture_output=True,check=True)
        info=json.loads(packed.stdout)[0]
        archive=temporary/info['filename']
        with tarfile.open(archive) as tar:tar.extractall(temporary)
        package=temporary/'package'
        provenance=json.loads((package/'vendor/parsanol-web/BUILT_FROM.json').read_text())
        for filename,checksum in provenance['files'].items():
            if hashlib.sha256((package/'vendor/parsanol-web'/filename).read_bytes()).hexdigest()!=checksum:
                raise RuntimeError('published browser asset checksum mismatch: '+filename)
        (temporary/'source.parg').write_text(SOURCE,encoding='utf-8')
        command=[args.node,'--input-type=module','-e',NODE_FIXTURE,str(package/'dist/runtime.js'),str(temporary/'source.parg')]
        if args.external_fixture:command.append(str(Path(args.external_fixture).resolve()))
        fixture=json.loads(subprocess.check_output(command,text=True,cwd=ROOT))
        requests=[]
        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self,*a,**kw):super().__init__(*a,directory=str(package),**kw)
            def send_response(self,code,message=None):
                requests.append({'path':self.path,'status':code});super().send_response(code,message)
            def do_GET(self):
                bodies={'/':('text/html; charset=utf-8',PAGE.encode()),'/fixture.json':('application/json',json.dumps(fixture).encode()),'/artifact.json':('application/json',json.dumps(fixture['artifact']).encode())}
                if self.path in bodies:
                    content_type,body=bodies[self.path];self.send_response(200);self.send_header('Content-Type',content_type);self.end_headers();self.wfile.write(body)
                elif self.path.startswith('/external-stage/') and args.external_fixture:
                    config=json.loads(Path(args.external_fixture).read_text())
                    directory=Path(config['stage_module']).resolve().parent
                    path=(directory/self.path.removeprefix('/external-stage/')).resolve()
                    if not path.is_relative_to(directory) or not path.is_file():self.send_error(404);return
                    self.send_response(200);self.send_header('Content-Type','text/javascript');self.end_headers();self.wfile.write(path.read_bytes())
                else:super().do_GET()
            def log_message(self,*a):pass
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        command=[browser,'--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions','--no-first-run','--user-data-dir='+str(temporary/'chrome-profile'),'--virtual-time-budget=20000','--dump-dom',f'http://127.0.0.1:{server.server_port}/']
        try:run=subprocess.run(command,text=True,capture_output=True,timeout=90)
        finally:server.shutdown();server.server_close()
        (output/'browser.stderr.log').write_text(run.stderr,encoding='utf-8')
        (output/'browser.dom.html').write_text(run.stdout,encoding='utf-8')
        match=re.search(r'<body>(.*?)</body>',run.stdout,re.S)
        if not match:raise RuntimeError('headless browser did not return a result DOM')
        result=json.loads(html.unescape(match[1]))
        wasm_requests=[r for r in requests if r['path'].endswith('parsanol_bg.wasm') and r['status']==200]
        result.update(node=node_version,browser=subprocess.check_output([browser,'--version'],text=True).strip(),browser_exit=run.returncode,packed_sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),web_wasm_sha256=hashlib.sha256((package/'vendor/parsanol-web/parsanol_bg.wasm').read_bytes()).hexdigest(),wasm_http_loads=len(wasm_requests),requests=requests)
        (output/'result.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({k:result[k] for k in ['ok','browser_exit','wasm_http_loads','browser']}|{'checks':len(result['checks']),'evidence':str(output/'result.json')}))
        if run.returncode or not result['ok'] or len(wasm_requests)!=1:raise RuntimeError('real browser runtime proof failed; inspect saved result')

if __name__=='__main__':main()
