/**
 * Compile PARG source to a checksummed artifact in-process — the
 * playground's compiler-in-the-browser seam (site#19). Single-file
 * grammars: `use` imports have no filesystem here and reject with the
 * merge error. The compiler stamp is the wasm build's crate version.
 *
 * @throws when the source does not parse or the grammar is invalid.
 */
export declare function compileSource(source: string): Record<string, unknown>;
import { PargRuntimeCore } from "./runtime-core.js";
export { deriveTemplate, renderSegments, materializeFromSchema, RecursionLimitExceeded, CallDepthLimitExceeded } from "./runtime-core.js";
export type { FieldRequirement, EntrySchema, Schema, RenderSegment, RecoveryError, RecoveryEnvelope, ParsingCompatibility, CompatibilityEnvelope, Materialized } from "./runtime-core.js";
/** Node entry: preserves synchronous WASM initialization and filesystem helpers. */
export declare class PargRuntime extends PargRuntimeCore {
    constructor(artifactJson: string, entry?: string);
    /** True when this artifact was compiled from `source` (the current .parg
     * revision). The compiler bakes a bare hex digest; artifacts without the
     * field answer false — unverifiable rather than fresh. */
    compiledFrom(source: string): boolean;
    /** Load an artifact JSON file and verify its checksum. */
    static fromFile(path: string, entry?: string): PargRuntime;
    /** The artifacts directory: PARG_ARTIFACT_DIR when set. */
    static artifactsDir(): string | null;
    /** Load `<dir>/<grammar>.json`; throws when no artifacts dir is set. */
    static load(grammar: string, entry?: string, dir?: string): PargRuntime;
}
