//! The declared per-target binding artifact (parsanol-ruby#432): the
//! Ruby-emitted fixture replays through the wasm seam — the engine
//! verifies each target artifact (kind, checksum, `ts` target, binding
//! version), pair-checks it against the parse artifact, and materializes
//! the declared records through the same apply core as the embedded
//! ones.

import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PargRuntime } from "../src/runtime.js";
import {
  BINDING_TARGETS,
  parseBindingsArtifact,
} from "../src/bindings-artifact.js";

interface BindingRecord {
  capture: string;
  path: string;
}

interface FixtureCase {
  grammar: string;
  entry: string;
  input: string;
  envelope: Record<string, unknown>;
  shape: unknown;
  artifacts: Record<string, { artifact_kind: string; entries: Record<string, { bindings: BindingRecord[] }> }>;
  bound: Record<string, unknown>;
}

// The compiler's canonical form (runtime.test.ts's helper): key-sorted
// JSON over the payload, checksum excluded.
function canon(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canon(v)]),
    );
  }
  return value;
}

function withChecksum(envelope: Record<string, unknown>): string {
  const payload: Record<string, unknown> = { ...envelope };
  delete payload.checksum;
  envelope.checksum =
    `sha256:${createHash("sha256").update(JSON.stringify(canon(payload))).digest("hex")}`;
  return JSON.stringify(envelope);
}

// The compiled test runs from dist-test/test; walk up to the package
// root (runtime.ts's pattern) where the vendored fixture lives.
const here = dirname(fileURLToPath(import.meta.url));
let root = here;
while (!existsSync(join(root, "package.json"))) root = dirname(root);
const fixture = JSON.parse(
  readFileSync(join(root, "test", "fixtures", "parg_binding_artifacts.json"), "utf8"),
) as { kind: string; cases: FixtureCase[] };

describe("declared bindings artifacts (#432)", () => {
  it("ruby-emitted artifacts verify and replay through the engine", () => {
    for (const artifactCase of fixture.cases) {
      const runtime = new PargRuntime(JSON.stringify(artifactCase.envelope));
      for (const target of BINDING_TARGETS) {
        const declared = parseBindingsArtifact(
          JSON.stringify(artifactCase.artifacts[target]),
          target,
        );
        assert.equal(declared.target, target);
        if (target === "ts") {
          const bound = runtime.applyBindingsArtifact(
            JSON.stringify(artifactCase.artifacts[target]),
            artifactCase.shape,
          );
          assert.deepEqual(
            bound,
            artifactCase.bound,
            `ts / ${artifactCase.input}`,
          );
        } else {
          // The wasm seam is the ts target's surface: foreign targets
          // pass the structural parse and are pinned out by the engine.
          assert.throws(
            () =>
              runtime.applyBindingsArtifact(
                JSON.stringify(artifactCase.artifacts[target]),
                artifactCase.shape,
              ),
            /targets "ruby", not "ts"|targets "rs", not "ts"|targets "python", not "ts"/,
          );
        }
      }
    }
  });

  it("structural parse rejects a foreign kind and unknown targets", () => {
    const sample = fixture.cases.find(
      (candidate) => Object.keys(candidate.artifacts["ts"].entries).length > 0,
    );
    assert.ok(sample, "a case with an entries map");
    for (const target of BINDING_TARGETS) {
      const payload = JSON.parse(JSON.stringify(sample.artifacts[target])) as Record<string, unknown>;
      payload["artifact_kind"] = "parg-tree";
      assert.throws(
        () => parseBindingsArtifact(JSON.stringify(payload)),
        /not a parg-bindings artifact/,
      );
    }
    assert.throws(
      () => parseBindingsArtifact(JSON.stringify(fixture.cases[0].artifacts["ts"]), "rs"),
      /targets "ts", not "rs"/,
    );
    assert.throws(
      () => parseBindingsArtifact('{"artifact_kind":"parg-bindings","target":"wasm"}'),
      /unknown binding target "wasm"/,
    );
  });

  it("the engine rejects tampered records (checksum mismatch)", () => {
    const artifactCase = fixture.cases.find((candidate) =>
      Object.values(candidate.artifacts["ts"].entries)
        .some((slot) => slot.bindings.length > 0),
    );
    assert.ok(artifactCase, "a case with declared records");
    const runtime = new PargRuntime(JSON.stringify(artifactCase.envelope));
    const payload = JSON.parse(JSON.stringify(artifactCase.artifacts["ts"])) as {
      entries: Record<string, { bindings: BindingRecord[] }>;
    };
    for (const slot of Object.values(payload.entries)) {
      if (slot.bindings.length > 0) {
        slot.bindings[0].path = "smuggled";
        break;
      }
    }
    assert.throws(
      () => runtime.applyBindingsArtifact(JSON.stringify(payload), artifactCase.shape),
      /checksum mismatch/,
    );
  });

  it("the engine pair-checks the declared artifact against the parse artifact", () => {
    const artifactCase = fixture.cases[0];
    // A self-consistent parse artifact whose source hash pins a
    // DIFFERENT grammar text: it loads (checksum re-derived), then the
    // pairing must refuse.
    const other = JSON.parse(JSON.stringify(artifactCase.envelope)) as Record<string, unknown>;
    other["source_hash"] = "0".repeat(64);
    const stranger = new PargRuntime(withChecksum(other));
    assert.throws(
      () =>
        stranger.applyBindingsArtifact(JSON.stringify(artifactCase.artifacts["ts"]), artifactCase.shape),
      /source_hash/,
    );
  });

  it("declared application matches the embedded records", () => {
    for (const artifactCase of fixture.cases) {
      const runtime = new PargRuntime(JSON.stringify(artifactCase.envelope));
      assert.deepEqual(
        runtime.applyBindings(artifactCase.shape),
        runtime.applyBindingsArtifact(JSON.stringify(artifactCase.artifacts["ts"]), artifactCase.shape),
      );
    }
  });
});
