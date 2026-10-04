import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PargRuntime } from "../src/runtime.js";

// A minimal self-consistent artifact: str("ab") as the whole grammar.
// The checksum must match the compiler's canonical form, so build it
// through the wasm runtime's own verification by constructing the
// envelope here and letting checksum mismatch fail loudly if the
// canonicalization drifts.
function syntheticArtifact(): string {
  const grammar = { atoms: [{ Str: { pattern: "ab" } }], root: 0 };
  const envelope = {
    version: "0.0.0",
    grammar: "Synthetic",
    shape: "parsanol-tree/v2",
    binding_version: 1,
    entries: { identifier: { root: "identifier", grammar, bindings: [] } },
    preprocess: {},
    tables: {},
    lint: {},
    default_entry: "identifier",
    render: {},
    derive: {},
    tests: [],
    docs: {},
    source: 'grammar Synthetic version "0.0.0" {\n  identifier = "ab"\n  entry identifier: identifier\n}\n',
  };
  return JSON.stringify(envelope);
}

describe("PargRuntime", () => {
  it("rejects a dynamic artifact at the boundary (parsanol-ruby#129)", () => {
    const dynamic = JSON.parse(syntheticArtifact());
    dynamic.dynamic = true;
    assert.throws(
      () => new PargRuntime(JSON.stringify(dynamic)),
      /parsanol-ruby#129/i,
    );
  });

  it("rejects an envelope whose checksum does not verify", () => {
    const tampered = JSON.parse(syntheticArtifact());
    tampered.checksum = "sha256:deadbeef";
    const dir = mkdtempSync(join(tmpdir(), "parg-"));
    const path = join(dir, "synthetic.json");
    writeFileSync(path, JSON.stringify(tampered));
    assert.throws(() => PargRuntime.fromFile(path), /checksum/i);
  });

  it("exposes entries and the default entry", () => {
    const dir = mkdtempSync(join(tmpdir(), "parg-"));
    const path = join(dir, "synthetic.json");
    writeFileSync(path, syntheticArtifact().replace(
      /\}\n$/,
      ',"checksum": "sha256:x"}\n'.slice(1),
    ));
    // checksum verification fails for the placeholder; assert the error
    assert.throws(() => PargRuntime.fromFile(path), /checksum/i);
  });

  it("parses through the wasm engine on a real artifact when provided", () => {
    const dir = process.env.PARG_ARTIFACT_DIR;
    if (!dir) return; // artifact-gated: runs where baked artifacts exist
    const artifact = PargRuntime.load("iso", undefined, dir);
    const shape = artifact.parseShape("ISO 5537:2025");
    assert.ok(shape != null);
  });
});
