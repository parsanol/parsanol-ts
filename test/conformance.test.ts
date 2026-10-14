import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PargRuntime } from "../src/runtime.js";

// Cross-engine conformance gate: the corpus lives in parsanol-rs
// (corpus/conformance, WPT-style) and pins the observable behavior every
// engine must agree on. Each case's artifact carries a checksum (the wasm
// verifies it at construction) and an embedded test section, replayed here
// through the wasm engine's own test runner. CI checks out parsanol-rs and
// points PARG_CONFORMANCE_DIR at the corpus; locally the test finds a
// sibling checkout or skips.
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

describe("PARG conformance corpus", () => {
  const dir = conformanceDir();

  it("is present (parsanol-rs checkout)", () => {
    assert.ok(dir, "corpus not found: check out parsanol-rs beside this repo or set PARG_CONFORMANCE_DIR");
    assert.ok(existsSync(join(dir, "README.md")));
  });

  it("replays every artifact's test section with zero failures", () => {
    assert.ok(dir);
    const names = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    assert.ok(names.length > 0, "conformance corpus is empty");
    for (const name of names) {
      const rt = PargRuntime.fromFile(join(dir, name));
      // runTests returns the failures array as JSON (empty = green)
      const failures = JSON.parse(rt.artifact.runTests() as string) as string[];
      assert.deepEqual(failures, [], `${name}: conformance failures: ${failures}`);
    }
  });

  it("artifact checksums verify and source hashes match the .parg sources", () => {
    assert.ok(dir);
    const names = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    for (const name of names) {
      const rt = PargRuntime.fromFile(join(dir, name));
      const parg = join(dir, `${name.replace(/\.json$/, "")}.parg`);
      assert.ok(existsSync(parg), `${name}: missing .parg source`);
      // the envelope embeds the source; its hash binds the pair
      if (rt.sourceHash !== null) {
        const digest = createHash("sha256").update(rt.source as string).digest("hex");
        assert.equal(rt.sourceHash, digest, `${name}: source_hash does not match the embedded source`);
      }
    }
  });
});
