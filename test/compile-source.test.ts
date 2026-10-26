import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PargRuntime, compileSource } from "../src/runtime.js";

// site#19: the wasm compiler's seam — source in, checksummed artifact
// out, and the artifact parses through the same package's runtime.
describe("compileSource", () => {
  it("compiles a grammar and the artifact loads and parses", () => {
    const artifact = compileSource(`
      grammar Demo version "1.0.0" {
        pair = ( 1*( %x61-7A / %x30-39 ) ) as k "=" ( 1*( %x30-39 ) ) as v ";"
        document = 1*( pair )
        entry main: document
        test { accept "a=1;b=2;" }
      }
    `);
    assert.equal(artifact["grammar"], "Demo");
    assert.equal(artifact["shape"], "parsanol-tree/v2");
    assert.ok(typeof artifact["checksum"] === "string");

    const json = JSON.stringify(artifact);
    const runtime = new PargRuntime(json);
    const shape = runtime.parseShape("a=1;b=2;");
    assert.ok(shape);
  });

  it("rejects an unparseable source with the parse error", () => {
    assert.throws(() => compileSource("nonsense"), /expected/);
  });

  it("rejects `use` imports (no filesystem in a browser)", () => {
    assert.throws(
      () =>
        compileSource(
          `use helper\ngrammar D version "1.0.0" {\n  entry m: m\n  m = "x"\n}`,
        ),
      /import/,
    );
  });
});
