import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PargRuntime, compileSource, CallDepthLimitExceeded } from "parsanol";
import { PargRuntime as BrowserRuntime, initialize } from "parsanol/browser";

const artifact = JSON.stringify(compileSource(`grammar Budget version "1.0.0" {
  main = "(" main ")" / "x"
  entry main: main
}`));
const nested = (depth: number) => "(".repeat(depth) + "x" + ")".repeat(depth);

// Both entries use the unchanged runtime bytes shipped with Parsanol 1.5.16.
await initialize(readFileSync(new URL("../../vendor/parsanol-web/parsanol_bg.wasm", import.meta.url)));

for (const [host, Runtime] of [["node", PargRuntime], ["web", BrowserRuntime]] as const) {
  describe(`${host} finite per-call depth`, () => {
    it("allows an explicit larger budget without changing later default calls", () => {
      const rt = new Runtime(artifact);
      try {
        assert.throws(() => rt.parseShape(nested(400)), CallDepthLimitExceeded);
        assert.equal(rt.parseShapeWithCallDepth(nested(400), "strict", "default", 8192).ok, true);
        assert.throws(() => rt.parseShape(nested(400)), CallDepthLimitExceeded);
        assert.throws(() => rt.parseShapeWithCallDepth(nested(2), "strict", "default", 1), CallDepthLimitExceeded);
        assert.equal(rt.parseShapeWithCallDepth("x", "strict", "default", 8192).ok, true);
      } finally { rt.artifact.free(); }
    });

    it("retains both compatibility policies, reporters and refusal envelopes", () => {
      const rt = new Runtime(artifact);
      try {
        for (const compatibility of ["strict", "parslet"] as const) {
          for (const reporter of ["default", "deepest"] as const) {
            const expected = rt.parseShapeWithReporter("z", compatibility, reporter);
            assert.deepEqual(rt.parseShapeWithCallDepth("z", compatibility, reporter, 8192), expected);
          }
        }
      } finally { rt.artifact.free(); }
    });

    it("rejects invalid JS numbers before the native boundary", () => {
      const rt = new Runtime(artifact);
      const original = rt.artifact.parseShapeWithCallDepth;
      rt.artifact.parseShapeWithCallDepth = () => { assert.fail("invalid budget reached WASM"); };
      try {
        for (const budget of [0, -1, 1.5, NaN, Infinity, -Infinity, 8193, "8192", null, undefined]) {
          assert.throws(() => rt.parseShapeWithCallDepth("x", "strict", "default", budget as number), RangeError);
        }
      } finally { rt.artifact.parseShapeWithCallDepth = original; rt.artifact.free(); }
    });

    it("preserves resource metadata and allows reuse after a refusal", () => {
      const rt = new Runtime(artifact);
      try {
        assert.throws(() => rt.parseShapeWithCallDepth(nested(20), "parslet", "deepest", 8), error => {
          assert(error instanceof CallDepthLimitExceeded);
          assert.equal(error.category, "call_depth_limit");
          assert.equal(error.maxDepth, 8);
          assert.equal(error.depth, 9);
          return true;
        });
        assert.equal(rt.parseShapeWithCallDepth("x", "strict", "default", 8192).ok, true);
      } finally { rt.artifact.free(); }
    });

    it("fails explicitly with an older injected engine", () => {
      const rt = new Runtime(artifact);
      const original = rt.artifact.parseShapeWithCallDepth;
      try {
        rt.artifact.parseShapeWithCallDepth = undefined;
        assert.throws(() => rt.parseShapeWithCallDepth("x", "strict", "default", 8192), /per-call depth/);
      } finally { rt.artifact.parseShapeWithCallDepth = original; rt.artifact.free(); }
    });
  });
}

it("Node preserves a trapped per-call error and rebuilds both artifact handles", () => {
  const rt = new PargRuntime(artifact);
  const other = new PargRuntime(artifact);
  const failure = new WebAssembly.RuntimeError("unreachable");
  rt.artifact.parseShapeWithCallDepth = () => { throw failure; };
  try {
    assert.throws(() => rt.parseShapeWithCallDepth("x", "strict", "default", 8192), error => error === failure);
    assert.equal(rt.parseShapeWithCallDepth("x", "strict", "default", 8192).ok, true);
    assert.equal(other.parseShapeWithCallDepth("x", "strict", "default", 8192).ok, true);
  } finally { rt.artifact.free(); other.artifact.free(); }
});
