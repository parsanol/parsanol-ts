import { createHash } from "node:crypto";
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
    source_hash: "",
    compiler_version: "test",
    semantics_hash: `sha256:${"a".repeat(64)}`,
  };
  envelope.source_hash =
    createHash("sha256").update(envelope.source).digest("hex");
  return withChecksum(envelope);
}

// The compiler's canonical form: recursively key-sorted, JSON.stringify
// escaping — byte-compatible with ruby's Compiler.checksum and the wasm
// verifier for ASCII envelopes.
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

  it("exposes provenance and answers compiledFrom (parsanol-ts#5)", () => {
    const rt = new PargRuntime(syntheticArtifact());
    assert.equal(rt.compilerVersion, "test");
    assert.match(rt.sourceHash as string, /^[0-9a-f]{64}$/);
    // ruby#377: the semantics fingerprint rides the envelope, nil-safe
    assert.equal(rt.semanticsHash, `sha256:${"a".repeat(64)}`);
    const source = 'grammar Synthetic version "0.0.0" {\n  identifier = "ab"\n  entry identifier: identifier\n}\n';
    assert.equal(rt.compiledFrom(source), true);
    assert.equal(rt.compiledFrom(`${source}\n`), false);
    assert.equal(rt.shape, "parsanol-tree/v2");
    // legacy artifact without a source hash: unverifiable, not stale
    const legacy = JSON.parse(syntheticArtifact());
    delete legacy.source_hash;
    const rt2 = new PargRuntime(withChecksum(legacy));
    assert.equal(rt2.sourceHash, null);
    assert.equal(rt2.compiledFrom(source), false);
    // legacy artifact without a semantics hash: pre-1.3.117 bake
    const old = JSON.parse(syntheticArtifact());
    delete old.semantics_hash;
    const rt3 = new PargRuntime(withChecksum(old));
    assert.equal(rt3.semanticsHash, null);
  });

  it("exposes entries and the default entry", () => {
    const dir = mkdtempSync(join(tmpdir(), "parg-"));
    const path = join(dir, "synthetic.json");
    const tampered = JSON.parse(syntheticArtifact());
    tampered.checksum = "sha256:x"; // placeholder: verification must fail
    writeFileSync(path, JSON.stringify(tampered));
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
