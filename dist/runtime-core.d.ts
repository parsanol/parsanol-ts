export interface WasmModule {
    PargArtifactJs: new (artifactJson: string) => any;
    compileSource: (source: string) => string;
}
type PargArtifactJs = any;
/** A native rule-recursion resource guard, distinct from syntax refusal. */
export declare class RecursionLimitExceeded extends Error {
    readonly depth: number;
    readonly maxDepth: number;
    readonly category = "recursion_limit";
    constructor(depth: number, maxDepth: number, message?: string);
}
/** WASM VM-call budget, separate from the rule-reference recursion guard. */
export declare class CallDepthLimitExceeded extends Error {
    readonly depth: number;
    readonly maxDepth: number;
    readonly category = "call_depth_limit";
    constructor(depth: number, maxDepth: number, message?: string);
}
/** Container nesting budget at the WASM binding shape-JSON bridge. */
export declare class ShapeDepthLimitExceeded extends Error {
    readonly depth: number;
    readonly maxDepth: number;
    readonly category = "shape_depth_limit";
    constructor(depth: number, maxDepth: number, message?: string);
}
/** A host stack overflow (RangeError) or wasm trap (RuntimeError) inside a
 * native call. A trap unwinds the host frames without running the wasm
 * epilogues, so the instance's linear-memory stack pointer and allocator
 * state are no longer trustworthy: later calls on that instance can fail
 * with "memory access out of bounds" even for trivial input. */
export declare function isEngineTrap(error: unknown): boolean;
/** A field requirement from the binding-requirements schema. */
export interface FieldRequirement {
    type: string;
    card: string;
    preprocess?: string;
}
/** The binding-requirements schema record for one entry. */
export interface EntrySchema {
    root: string;
    fields: Record<string, FieldRequirement>;
    examples: {
        input: string;
        captures: Record<string, unknown>;
    }[];
}
export type Schema = Record<string, EntrySchema>;
/**
 * A loaded, checksum-verified PG artifact with its schema.
 * Construction throws when the checksum does not verify.
 */
export declare class PargRuntimeCore {
    /** The native artifact handle. Replaced after an engine trap, when the
     * entry re-instantiates the wasm engine (see `isEngineTrap`). */
    artifact: PargArtifactJs;
    readonly schema: Schema;
    readonly renderSpec: Record<string, RenderSegment[]>;
    readonly entry: string;
    readonly defaultEntry: string | null;
    /** parsanol-ts#5 provenance: SHA-256 of the .parg source text and the
     * compiler version. Null for artifacts compiled before these fields
     * existed (unverifiable, not stale). */
    readonly sourceHash: string | null;
    readonly compilerVersion: string | null;
    readonly source: string | null;
    /** ruby#377 semantics fingerprint: stable across producer metadata
     * (compiler_version, unicode_tables), so gates can tell "re-baked by
     * a newer compiler" from "the grammar changed". Null for artifacts
     * baked before the field existed (parsanol >= 1.3.117 / rs 0.19.14). */
    readonly semanticsHash: string | null;
    readonly envelope: Record<string, unknown>;
    private readonly artifactJson;
    private readonly engine;
    private readonly resetEngine;
    private module;
    /** `resetEngine` drops a trapped engine so the next `engine()` call
     * instantiates a fresh one; entries without it keep the old behavior. */
    constructor(artifactJson: string, entry: string | undefined, engine: () => WasmModule, resetEngine?: (engine: WasmModule) => void);
    /** The wire-format family ("parsanol-tree/v2"): a shape bump requires a
     * new engine family; same-shape artifacts parse identically forever. */
    get shape(): string | null;
    /** Run one native call. After an engine trap the entry drops the trapped
     * instance and this runtime rebuilds its artifact on a fresh one, so one
     * refused input cannot break every later parse in the process. The
     * original error is rethrown unchanged. */
    private native;
    /** Rebuild the artifact on the current engine. The old handle belongs to
     * the dropped instance and is not freed through it. */
    private rebind;
    /** Parse with the native wasm engine; returns the parsanol-shape tree. */
    parseShape(input: string): unknown;
    /** Explicit historical memo/causal-diagnostic policy; old APIs remain strict.
     * This is a parse result, not a best-effort recovery capture envelope. */
    parseShapeWithCompatibility(input: string, compatibility: ParsingCompatibility): CompatibilityEnvelope;
    /**
     * Parse with an explicit failure reporter. `"deepest"` reports the
     * furthest failure (how the Ruby engine reports refusals); `"default"`
     * keeps the existing parseShape cause selection. The result is the
     * shape-or-error envelope:
     * `{ ok: true, shape } | { ok: false, error }`.
     */
    parseShapeWithReporter(input: string, compatibility: ParsingCompatibility, reporter?: FailureReporter): ReporterEnvelope;
    /** Parse with an explicit finite VM-call budget for this invocation only.
     * Rule-reference and shape-JSON limits remain independent. Older methods
     * retain the engine's default budget. */
    parseShapeWithCallDepth(input: string, compatibility: ParsingCompatibility, reporter: FailureReporter, maxCallDepth: number): ReporterEnvelope;
    /**
     * Best-effort syntax recovery. Resource aborts throw typed errors. Success returns
     * `{ ok: true, shape }`; failure returns
     * `{ ok: false, captures, error, consumed_upto }` — the captures
     * observed before the failure plus the failure wire.
     */
    parseShapeRecovering(input: string): RecoveryEnvelope;
    /** Apply the entry's bindings to a parsanol-shape tree. */
    applyBindings(shape: unknown): Record<string, unknown>;
    /** Apply an entry's DECLARED bindings artifact (parsanol-ruby#432) to
     * a parsanol-shape tree. The engine verifies the artifact (kind,
     * canonical-JSON checksum, `ts` target pin, binding version) and
     * pair-checks it against this artifact by grammar source hash before
     * the shared apply core runs — the JSON materialized is the JSON the
     * checksum pinned. */
    applyBindingsArtifact(bindingsJson: string, shape: unknown): Record<string, unknown>;
    /** Parse and bind in one step. */
    parseAndBind(input: string): Record<string, unknown> | null;
    /**
     * Schema-driven materialization: the schema (from the artifact, not
     * hand-written model code) declares the fields a data model must
     * implement; the bound captures populate a structurally-typed object.
     * Card `1*`/`*` fields become arrays; `0..1` fields become nullable.
     */
    materialize(input: string): Materialized | null;
    /** Render the identifier string from a bound map (F6). */
    render(bound: Record<string, unknown>, variant?: string): string;
    /** Parse, bind, and render in one step. */
    renderString(input: string, variant?: string): string | null;
    /** Evaluate a named derive spec against a bound map (F6). */
    derive(name: string, bound: Record<string, unknown>): string;
    /** Parse, bind, and evaluate a derive spec in one step. */
    deriveString(input: string, name: string): string | null;
    /** Run the artifact's embedded tests; empty list means green. */
    runTests(): string[];
}
/** F6 v1 derive evaluator: {field} interpolates from the bound map. */
export declare function deriveTemplate(derive: Record<string, string>, name: string, bound: Record<string, unknown>): string;
export type RenderSegment = {
    type: "field";
    field: string;
} | {
    type: "literal";
    text: string;
} | {
    type: "cond";
    field: string;
    then: RenderSegment[];
};
/** F6 v1 generic renderer: field / literal / cond-presence segments. */
export declare function renderSegments(segments: RenderSegment[] | null, bound: Record<string, unknown>): string;
/** A schema-materialized identifier: typed fields plus provenance. */
export type ParsingCompatibility = "strict" | "parslet";
export type CompatibilityEnvelope = {
    ok: true;
    shape: unknown;
} | {
    ok: false;
    error: {
        offset: number;
        ranked: [number, string[]][];
    };
};
/** The failure-report mode for parseShapeWithReporter: "deepest" reports
 * the furthest failure (the Ruby engine's refusal report). */
export type FailureReporter = "default" | "deepest";
export type ReporterError = {
    offset: number;
    ranked: [number, string[]][];
} | {
    category: "recursion_limit";
    offset: null;
    depth: number;
    max_depth: number;
};
export type ReporterEnvelope = {
    ok: true;
    shape: unknown;
} | {
    ok: false;
    error: ReporterError;
};
export interface RecoveryError {
    offset: number;
    message?: string;
    expected?: string[];
    line?: number;
    column?: number;
}
/** The parseShapeRecovering envelope (TODO.sota/1). */
export interface RecoveryEnvelope {
    ok: boolean;
    shape?: unknown;
    captures?: Record<string, unknown[]>;
    error?: RecoveryError;
    consumed_upto?: number;
}
export interface Materialized {
    entry: string;
    attributes: Record<string, unknown>;
}
/**
 * Schema-driven materialization independent of any wasm handle —
 * the same function the model layer will build on (T2 codegen emits the
 * static view of exactly these fields).
 */
export declare function materializeFromSchema(schema: EntrySchema, bound: Record<string, unknown>): Materialized;
export {};
