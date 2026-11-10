//! The PARG artifact runtime for TypeScript: checksum-verified artifact
//! load, native wasm parse, bindings application, and schema-driven
//! materialization. The engine is the vendored parsanol wasm build
//! (PargArtifactJs) — no grammar code lives in this package; the baked
//! artifact is the contract.

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";


/**
 * Compile PARG source to a checksummed artifact in-process — the
 * playground's compiler-in-the-browser seam (site#19). Single-file
 * grammars: `use` imports have no filesystem here and reject with the
 * merge error. The compiler stamp is the wasm build's crate version.
 *
 * @throws when the source does not parse or the grammar is invalid.
 */
export function compileSource(source: string): Record<string, unknown> {
  return JSON.parse(wasm().compileSource(source)) as Record<string, unknown>;
}

/** Walk up from this module to the package root (which holds package.json). */
const packageRootCache = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (; !existsSync(join(dir, "package.json")); dir = dirname(dir)) {
    if (dir === dirname(dir)) throw new Error("package.json not found above the parg runtime");
  }
  return dir;
})();

function packageRoot(): string {
  return packageRootCache;
}

// The vendored wasm glue is CommonJS and lives outside the compiled tree,
// so resolve it against the package root at runtime. Loading is deferred
// to the first artifact construction: importing this module costs
// nothing, and the ~1.5 MB wasm compiles only when parsing is real.
const require = createRequire(import.meta.url);
let wasmModule: WasmModule | null = null;

function wasm(): WasmModule {
  if (wasmModule === null) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    wasmModule = require(
      join(packageRoot(), "vendor", "parsanol-wasm", "parsanol.cjs"),
    ) as WasmModule;
  }
  return wasmModule;
}


import { PargRuntimeCore, type WasmModule } from "./runtime-core.js";
export { deriveTemplate, renderSegments, materializeFromSchema, RecursionLimitExceeded, CallDepthLimitExceeded } from "./runtime-core.js";
export type { FieldRequirement, EntrySchema, Schema, RenderSegment, RecoveryError, RecoveryEnvelope, ParsingCompatibility, CompatibilityEnvelope, Materialized } from "./runtime-core.js";

/** Node entry: preserves synchronous WASM initialization and filesystem helpers. */
export class PargRuntime extends PargRuntimeCore {
  constructor(artifactJson: string, entry?: string) {
    super(artifactJson, entry, wasm);
  }

  /** True when this artifact was compiled from `source` (the current .parg
   * revision). The compiler bakes a bare hex digest; artifacts without the
   * field answer false — unverifiable rather than fresh. */
  compiledFrom(source: string): boolean {
    if (this.sourceHash === null) return false;
    return this.sourceHash === createHash("sha256").update(source).digest("hex");
  }

  /** Load an artifact JSON file and verify its checksum. */
  static fromFile(path: string, entry?: string): PargRuntime {
    return new PargRuntime(readFileSync(path, "utf8"), entry);
  }

  /** The artifacts directory: PARG_ARTIFACT_DIR when set. */
  static artifactsDir(): string | null {
    return process.env.PARG_ARTIFACT_DIR ?? null;
  }

  /** Load `<dir>/<grammar>.json`; throws when no artifacts dir is set. */
  static load(grammar: string, entry?: string, dir?: string): PargRuntime {
    const base = dir ?? PargRuntime.artifactsDir();
    if (!base) {
      throw new Error("no artifacts directory: set PARG_ARTIFACT_DIR or pass dir");
    }
    return PargRuntime.fromFile(join(base, `${grammar}.json`), entry);
  }

}
