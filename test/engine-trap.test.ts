import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PargRuntime } from "../src/runtime.js";

// Same recursive fixture as depth.test.ts.
function runtime(): PargRuntime {
  const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const value:any={shape:'parsanol-tree/v2',grammar:'Recursive',version:'1.0.0',default_entry:'main',entries:{main:{root:'main',grammar:{root:0,atoms:[{Entity:{atom:1}},{Alternative:{atoms:[2,5]}},{Sequence:{atoms:[3,0,4]}},{Str:{pattern:'('}},{Str:{pattern:')'}},{Str:{pattern:'x'}}]}}}};
  value.checksum='sha256:'+createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
  return new PargRuntime(JSON.stringify(value));
}
const nested=(depth:number)=>'('.repeat(depth)+'x'+')'.repeat(depth);

// Fill most of the host stack in JS, then parse: the host stack overflows
// inside the wasm call, below the engine's own call-depth cap.
function parseNearStackLimit(rt:PargRuntime):unknown{
  function deep(n:number):unknown{
    if(n>0){const result=deep(n-1);return result;}
    try{rt.parseShape(nested(900));return 'ok';}catch(error){return error;}
  }
  for(const depth of [9000,8000,7000,6000,5000,4000,3000,2000]){
    try{return deep(depth);}catch(error){if(!(error instanceof RangeError))throw error;}
  }
  return 'ok';
}

describe('engine trap recovery',()=>{
  it('keeps parsing after host stack overflows inside the wasm call',()=>{
    const rt=runtime();
    const other=runtime();
    let trapped=0;
    for(let round=0;round<30;round++){
      const result=parseNearStackLimit(rt);
      if(result instanceof RangeError)trapped++;
      else if(result!=='ok')throw result;
      for(const it of [rt,other]){
        assert.doesNotThrow(()=>it.parseShape('x'),`round ${round}`);
        assert.doesNotThrow(()=>it.parseShape(nested(200)),`round ${round}`);
      }
    }
    assert(trapped>0,'no host stack overflow was provoked');
  });
});
