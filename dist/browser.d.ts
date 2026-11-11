import type { InitInput } from "../vendor/parsanol-web/parsanol.js";
import { PargRuntimeCore } from "./runtime-core.js";
export { deriveTemplate, renderSegments, materializeFromSchema, RecursionLimitExceeded, CallDepthLimitExceeded, ShapeDepthLimitExceeded } from "./runtime-core.js";
export type { FieldRequirement, EntrySchema, Schema, RenderSegment, RecoveryError, RecoveryEnvelope, ParsingCompatibility, CompatibilityEnvelope, Materialized } from "./runtime-core.js";
/** Fetch/instantiate the web-target engine; custom bytes, module or URL are supported. */
export declare function initialize(input?: InitInput | Promise<InitInput>): Promise<void>;
export default initialize;
/** Compile PARG using the same initialized web engine used for parsing. */
export declare function compileSource(source: string): Record<string, unknown>;
export declare class PargRuntime extends PargRuntimeCore {
    constructor(artifactJson: string, entry?: string);
    /** Source verification uses asynchronous browser WebCrypto, unlike the Node entry. */
    compiledFrom(source: string): Promise<boolean>;
    /** Load a checksummed artifact over HTTP; rejects non-success HTTP status. */
    static fromURL(url: string | URL, entry?: string): Promise<PargRuntime>;
}
