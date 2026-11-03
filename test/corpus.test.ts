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
      // The self-description artifact is still authored (and baked) at
      // edition 1; its edition-2 migration is the F10 follow-up on
      // pubid-grammar (the self-host walker reads the edition-1 tree
      // shapes). Until that re-bake lands, the loader's removal
      // rejection for this one artifact is the expected state.
      if (file === "parg.json") continue;
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
      if (file === "parg.json") continue; // F10 edition-2 follow-up (see above)
      const rt = PargRuntime.fromFile(join(dir, file));
      assert.ok(rt.entry.length > 0, `${file}: no entry resolved`);
      assert.match(rt.envelope["checksum"] as string, /^sha256:/, `${file}: checksum shape`);
    }
  });
});
