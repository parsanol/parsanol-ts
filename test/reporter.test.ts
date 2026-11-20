import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PargRuntime, type ParsingCompatibility } from "../src/runtime.js";

// The explicit failure reporter over the wasm engine: "deepest" reports
// the furthest failure; "default" keeps the existing cause selection.
function runtime(prefix: string): PargRuntime {
  const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) :
    value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const envelope: any = {shape:"parsanol-tree/v2",grammar:"Reporter",version:"1.0.0",default_entry:"main",
    entries:{main:{root:"main",grammar:{root:6,atoms:[
      {Str:{pattern:prefix+"x"}},{Str:{pattern:prefix+"y"}},{Str:{pattern:prefix}},
      {Str:{pattern:"!"}},
      {Sequence:{atoms:[0,3]}},{Sequence:{atoms:[1,3]}},
      {Alternative:{atoms:[4,5]}}]}}}};
  envelope.checksum="sha256:"+createHash("sha256").update(JSON.stringify(canonical(envelope))).digest("hex");
  return new PargRuntime(JSON.stringify(envelope));
}

describe("parseShapeWithReporter", () => {
  const prefix = "a";

  it("returns the shape envelope on success for both reporters", () => {
    const rt = runtime(prefix);
    try {
      for (const reporter of ["default", "deepest"] as const) {
        const result = rt.parseShapeWithReporter(prefix + "x!", "strict", reporter);
        assert.equal(result.ok, true);
        if (result.ok) assert.deepEqual(result.shape, rt.parseShape(prefix + "x!"));
      }
    } finally { rt.artifact.free(); }
  });

  it("reports refusals as error envelopes with numeric offsets", () => {
    const rt = runtime(prefix);
    try {
      for (const reporter of ["default", "deepest"] as const) {
        const result = rt.parseShapeWithReporter(prefix + "z", "strict", reporter);
        assert.equal(result.ok, false);
        if (!result.ok) {
          assert.ok(!("category" in result.error));
          assert.equal(typeof result.error.offset, "number");
          assert.ok(Array.isArray(result.error.ranked));
        }
      }
    } finally { rt.artifact.free(); }
  });

  it("keeps the deepest offset at least the default's (the furthest failure)", () => {
    const rt = runtime(prefix);
    try {
      const dflt = rt.parseShapeWithReporter(prefix + "z", "strict", "default");
      const deep = rt.parseShapeWithReporter(prefix + "z", "strict", "deepest");
      assert.equal(dflt.ok, false);
      assert.equal(deep.ok, false);
      if (!dflt.ok && !deep.ok) {
        assert.ok((deep.error as { offset: number }).offset >=
          (dflt.error as { offset: number }).offset,
          "deepest reports at or past the default cause");
      }
    } finally { rt.artifact.free(); }
  });

  it("rejects an unknown reporter", () => {
    const rt = runtime(prefix);
    try {
      assert.throws(
        () => rt.parseShapeWithReporter(prefix + "x!", "strict", "outermost" as never),
        /unknown failure reporter/,
      );
    } finally { rt.artifact.free(); }
  });

  it("fails explicitly when an older injected engine lacks the reporter ABI", () => {
    const rt = runtime(prefix);
    const original = rt.artifact.parseShapeWithReporter;
    try {
      rt.artifact.parseShapeWithReporter = undefined;
      assert.throws(() => rt.parseShapeWithReporter(prefix + "x!", "strict"), /failure reporter/);
    } finally {
      rt.artifact.parseShapeWithReporter = original;
      rt.artifact.free();
    }
  });
});
