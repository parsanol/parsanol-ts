//! The PARG artifact runtime for TypeScript: checksum-verified artifact
//! load, native wasm parse, bindings application, and schema-driven
//! materialization. The engine is the vendored parsanol wasm build
//! (PargArtifactJs) — no grammar code lives in this package; the baked
//! artifact is the contract.
import { createHash } from "node:crypto";
import * as engine from "../vendor/parsanol-web/parsanol.js";
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
export function compileSource(source) {
    return JSON.parse(wasm().compileSource(source));
}
/** Walk up from this module to the package root (which holds package.json). */
const packageRootCache = (() => {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (; !existsSync(join(dir, "package.json")); dir = dirname(dir)) {
        if (dir === dirname(dir))
            throw new Error("package.json not found above the parg runtime");
    }
    return dir;
})();
function packageRoot() {
    return packageRootCache;
}
// Node and browsers share the one vendored web-target engine; the browser
// entry imports the same glue. Instantiation is deferred to the first
// artifact construction and is synchronous from the package's own bytes:
// importing this module costs nothing, and the ~1.5 MB wasm compiles only
// when parsing is real.
let wasmModule = null;
function wasm() {
    if (wasmModule === null) {
        engine.initSync({ module: readFileSync(join(packageRoot(), "vendor", "parsanol-web", "parsanol_bg.wasm")) });
        wasmModule = engine;
    }
    return wasmModule;
}
import { PargRuntimeCore } from "./runtime-core.js";
export { deriveTemplate, renderSegments, materializeFromSchema, RecursionLimitExceeded, CallDepthLimitExceeded, ShapeDepthLimitExceeded } from "./runtime-core.js";
/** Node entry: preserves synchronous WASM initialization and filesystem helpers. */
export class PargRuntime extends PargRuntimeCore {
    constructor(artifactJson, entry) {
        super(artifactJson, entry, wasm);
    }
    /** True when this artifact was compiled from `source` (the current .parg
     * revision). The compiler bakes a bare hex digest; artifacts without the
     * field answer false — unverifiable rather than fresh. */
    compiledFrom(source) {
        if (this.sourceHash === null)
            return false;
        return this.sourceHash === createHash("sha256").update(source).digest("hex");
    }
    /** Load an artifact JSON file and verify its checksum. */
    static fromFile(path, entry) {
        return new PargRuntime(readFileSync(path, "utf8"), entry);
    }
    /** The artifacts directory: PARG_ARTIFACT_DIR when set. */
    static artifactsDir() {
        return process.env.PARG_ARTIFACT_DIR ?? null;
    }
    /** Load `<dir>/<grammar>.json`; throws when no artifacts dir is set. */
    static load(grammar, entry, dir) {
        const base = dir ?? PargRuntime.artifactsDir();
        if (!base) {
            throw new Error("no artifacts directory: set PARG_ARTIFACT_DIR or pass dir");
        }
        return PargRuntime.fromFile(join(base, `${grammar}.json`), entry);
    }
}
