import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compileSource, PargRuntime, type RecoveryEnvelope } from "../src/runtime.js";

// TODO.sota/1 R1: parseShapeRecovering never throws. Success passes the
// shape through verbatim; failure returns the recovery envelope — the
// captures observed before the failure plus the failure wire — with
// consumed_upto the furthest successful match end.
function conformanceDir(): string | null {
  if (process.env.PARG_CONFORMANCE_DIR) return process.env.PARG_CONFORMANCE_DIR;
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "parsanol-rs", "corpus", "conformance");
    if (existsSync(candidate)) return candidate;
    dir = join(dir, "..");
  }
  return null;
}

describe("parseShapeRecovering (TODO.sota/1)", () => {
  const dir = conformanceDir();

  it("passes the shape through on success", () => {
    assert.ok(dir);
    const rt = PargRuntime.fromFile(join(dir, "atoms_lexical.json"));
    const okInput = "ab 42";
    const plain = rt.parseShape(okInput);
    const recovered: RecoveryEnvelope = rt.parseShapeRecovering(okInput);
    assert.equal(recovered.ok, true);
    assert.deepEqual(recovered.shape, plain);
  });

  // R1.5 cross-engine canonical equality: the SAME kv fixture the rs
  // suite pins (parsanol-rs tests/parg_recovery.rs) must produce the
  // byte-identical wire through the wasm — the partial tree is the
  // deepest repetition prefix shaped like the root, here the one
  // complete pair under the entry root name.
  it("carries the partial tree byte-identically to the rs wire", () => {
    const source = [
      'grammar Kv version "1.0.0" edition 2 {',
      '  pair = 1*(%x61-7A / %x30-39) as k "=" 1*%x30-39 as v ";"',
      "  document = 1*pair",
      "  entry main: document",
      "}",
    ].join("\n");
    const artifactText = JSON.stringify(compileSource(source));
    const rt = new PargRuntime(artifactText, "main");
    const recovered = rt.parseShapeRecovering("a=1;b=2");
    // The R1.5 payload — the partial tree — is byte-identical to the
    // rs suite's canonical JSON (tests/parg_recovery.rs's fixture):
    const pinnedPartial =
      '{"document":[{"k":{"value":"a","line":1,"column":1,"offset":0,"length":1},"v":{"value":"1","line":1,"column":3,"offset":2,"length":1}}]}';
    assert.equal(
      JSON.stringify(recovered.partial),
      pinnedPartial,
      "the wasm partial tree must match the rs canonical JSON byte-for-byte",
    );
    // The typed surface: the partial is the root-shaped hash; the
    // other envelope fields hold structurally. The expected-label set
    // intentionally differs from the rs fixture's: the rs test's
    // grammar wraps its terminals in dynamic() (no failure labels);
    // the PARG source's class alternatives carry theirs.
    assert.equal(recovered.ok, false);
    assert.equal(recovered.consumed_upto, 7);
    assert.equal(recovered.error?.offset, 7);
    assert.deepEqual(recovered.recovered_spans, [{ offset: 0, end: 4 }]);
    const partial = recovered.partial as Record<string, unknown>;
    assert.ok(partial && Array.isArray(partial.document));
    assert.equal((partial.document as unknown[]).length, 1);
  });

  it("reports the recovery envelope on failure, never throwing", () => {
    assert.ok(dir);
    const rt = PargRuntime.fromFile(join(dir, "atoms_lexical.json"));
    // "ab " truncates after the separator: digits fail at EOF.
    const recovered: RecoveryEnvelope = rt.parseShapeRecovering("ab ");
    assert.equal(recovered.ok, false);
    assert.equal(typeof recovered.error?.offset, "number");
    assert.equal(typeof recovered.consumed_upto, "number");
    assert.ok(recovered.error!.offset! >= 3);
  });
});
