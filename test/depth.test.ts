import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PargRuntime, CallDepthLimitExceeded, ShapeDepthLimitExceeded } from "../src/runtime.js";

// Same recursive resource fixture as parsanol-rs parg_compatibility.rs.
function runtime(): PargRuntime {
  const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const value:any={shape:'parsanol-tree/v2',grammar:'Recursive',version:'1.0.0',default_entry:'main',entries:{main:{root:'main',grammar:{root:0,atoms:[{Entity:{atom:1}},{Alternative:{atoms:[2,5]}},{Sequence:{atoms:[3,0,4]}},{Str:{pattern:'('}},{Str:{pattern:')'}},{Str:{pattern:'x'}}]}}}};
  value.checksum='sha256:'+createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
  return new PargRuntime(JSON.stringify(value));
}
describe('typed WASM call-depth resources',()=>{
  it('preserves supported nesting and returns typed resource aborts with reuse/free',()=>{
    const rt=runtime();
    try{
      for(const depth of [64,128,256]){
        assert.doesNotThrow(()=>rt.parseShape('('.repeat(depth)+'x'+')'.repeat(depth)));
        assert.doesNotThrow(()=>rt.parseShape('x'));
      }
      const excessive='('.repeat(1200)+'x'+')'.repeat(1200);
      for(const method of ['parseShape','parseShapeRecovering','parseShapeWithCompatibility']as const){
        assert.throws(()=>method==='parseShapeWithCompatibility'?rt[method](excessive,'parslet'):rt[method](excessive),error=>{
          assert(error instanceof CallDepthLimitExceeded);assert.equal(error.category,'call_depth_limit');assert.equal(error.maxDepth,1024);return true;
        });
        assert.doesNotThrow(()=>rt.parseShape('x'));
      }
    }finally{rt.artifact.free();}
  });
  it('round-trips bounded shape JSON and reports excessive shape nesting separately',()=>{
    const rt=runtime();
    try {
      let shape:unknown='x';
      for(let depth=1;depth<=513;depth++){
        shape=[shape];
        if(depth===128||depth===512)assert.deepEqual(rt.applyBindings(shape),{});
      }
      assert.throws(()=>rt.applyBindings(shape),error=>{
        assert(error instanceof ShapeDepthLimitExceeded);assert.equal(error.depth,513);assert.equal(error.maxDepth,512);return true;
      });
      assert.deepEqual(rt.applyBindings(rt.parseShape('x')),{});
    }finally{rt.artifact.free();}
  });
  it('preserves generic VM and host errors without inventing a depth category',()=>{
    const rt=runtime();const original=rt.artifact.parseShape;
    try{
      for(const failure of [new WebAssembly.RuntimeError('memory access out of bounds'),new RangeError('Maximum call stack size exceeded')]){
        rt.artifact.parseShape=()=>{throw failure;};assert.throws(()=>rt.parseShape('x'),error=>error===failure);
      }
    }finally{rt.artifact.parseShape=original;rt.artifact.free();}
  });
});
