import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PargRuntime, type RecoveryEnvelope } from "../src/runtime.js";

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
