import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PargRuntime } from "../src/runtime.js";

// Cross-engine quality gate: every baked artifact's embedded suite must
// run green through this runtime — the same suite the Ruby and Rust
// engines validate against. Skips when no artifacts dir is set.
const dir = process.env.PARG_ARTIFACT_DIR;

describe("baked artifact corpus", () => {
  it("runs every embedded suite green through the wasm runtime", () => {
    if (!dir || !existsSync(dir)) return; // artifact-gated
    const artifacts = readdirSync(dir).filter((f) => f.endsWith(".json"));
    assert.ok(artifacts.length >= 40, `expected the full flavor set, found ${artifacts.length}`);

    const failures: string[] = [];
    for (const file of artifacts) {
      const rt = PargRuntime.fromFile(join(dir, file));
      for (const failure of rt.runTests()) {
        failures.push(`${file}: ${failure}`);
      }
    }
    assert.deepEqual(failures, []);
  });

  it("exposes at least the documented entry on each artifact", () => {
    if (!dir || !existsSync(dir)) return;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const rt = PargRuntime.fromFile(join(dir, file));
      assert.ok(rt.entry.length > 0, `${file}: no entry resolved`);
      assert.match(rt.envelope["checksum"] as string, /^sha256:/, `${file}: checksum shape`);
    }
  });
});
