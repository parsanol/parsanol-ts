import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PargRuntime, type ParsingCompatibility } from "../src/runtime.js";

// Mirrors parsanol-rs portable/parser/compatibility_tests.rs's causal probe.
function runtime(prefix: string): PargRuntime {
  const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) :
    value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const envelope: any = {shape:"parsanol-tree/v2",grammar:"DiagnosticPolicy",version:"1.0.0",default_entry:"main",
    entries:{main:{root:"main",grammar:{root:6,atoms:[{Str:{pattern:prefix+"b"}},{Str:{pattern:"c"}},
      {Sequence:{atoms:[0,1]}},{Lookahead:{atom:2,positive:false}},{Str:{pattern:prefix}},
      {Str:{pattern:"!"}},{Sequence:{atoms:[3,4,5]}}]}}}};
  envelope.checksum="sha256:"+createHash("sha256").update(JSON.stringify(canonical(envelope))).digest("hex");
  return new PargRuntime(JSON.stringify(envelope));
}

describe("explicit parsing compatibility", () => {
  for (const [prefix,input,causal] of [["a","ab?",1],["α","αb?",2]] as const) {
    it(`preserves strict defaults and selects causal UTF-8 offset for ${prefix}`, () => {
      const rt=runtime(prefix);
      try {
        for(const [policy,expected] of [["strict",causal+1],["parslet",causal]] as const){
          const result=rt.parseShapeWithCompatibility(input,policy);
          assert.equal(result.ok,false);
          if(!result.ok)assert.equal(result.error.offset,expected);
        }
        assert.equal(rt.parseShapeRecovering(input).error?.offset,causal+1);
        assert.throws(()=>rt.parseShape(input));
        const accepted=rt.parseShapeWithCompatibility(prefix+"!","parslet");
        assert.equal(accepted.ok,true);
        if(accepted.ok)assert.deepEqual(accepted.shape,rt.parseShape(prefix+"!"));
        assert.throws(()=>rt.parseShapeWithCompatibility(input,"unknown" as ParsingCompatibility),/unknown parsing compatibility/);
      } finally {rt.artifact.free();}
    });
  }
  it("fails explicitly when an older injected engine lacks the policy ABI", () => {
    const rt=runtime("a");const method=rt.artifact.parseShapeWithCompatibility;
    try {
      rt.artifact.parseShapeWithCompatibility=undefined;
      assert.throws(()=>rt.parseShapeWithCompatibility("a!","parslet"),/does not expose/);
    } finally {rt.artifact.parseShapeWithCompatibility=method;rt.artifact.free();}
  });
});
