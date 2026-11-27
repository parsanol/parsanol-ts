import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { compileSource } from "parsanol";
import { PargRuntime, initialize } from "parsanol/browser";
// Type-only: a TypeScript Worker must type-check `import wasm from "parsanol/wasm"`;
// under wrangler/esbuild the default import is a compiled WebAssembly.Module.
import type workerWasm from "parsanol/wasm";
const _workerWasmIsModule: WebAssembly.Module = null as unknown as typeof workerWasm;
void _workerWasmIsModule;

// The web-target wasm is a public subpath so that a bundler which imports
// wasm as a module (wrangler/esbuild in a Cloudflare Worker) can resolve it
// through the `exports` map, and so build scripts can locate the file.
const vendored = realpathSync(fileURLToPath(new URL("../../vendor/parsanol-web/parsanol_bg.wasm", import.meta.url)));

describe("parsanol/wasm subpath export", () => {
  it("resolves through require.resolve to the vendored web wasm", () => {
    const resolved = createRequire(import.meta.url).resolve("parsanol/wasm");
    assert.equal(realpathSync(resolved), vendored);
    assert.ok(existsSync(resolved));
  });

  it("resolves through import.meta.resolve to the same file", () => {
    const resolved = fileURLToPath(import.meta.resolve("parsanol/wasm"));
    assert.equal(realpathSync(resolved), vendored);
  });

  it("initializes the browser entry from a compiled WebAssembly.Module (the worker path)", async () => {
    const path = createRequire(import.meta.url).resolve("parsanol/wasm");
    const module = await WebAssembly.compile(readFileSync(path));
    await initialize(module);
    const artifact = JSON.stringify(compileSource(`grammar W version "1.0.0" {
  main = "ok"
  entry main: main
}`));
    const rt = new PargRuntime(artifact);
    try {
      assert.notEqual(rt.parseShape("ok"), undefined);
    } finally { rt.artifact.free(); }
  });
});
