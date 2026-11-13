// Node usage: the default init fetches the wasm next to the module,
// which Node does not serve; use initSync with pre-read bytes:
//   import { initSync } from ./parsanol.js;
//   import { readFileSync } from node:fs;
//   initSync({ module: readFileSync(./parsanol_bg.wasm) });
// The async bootstrap is the DEFAULT export (__wbg_init): Promise<InitOutput>.
// parseAndBind returns {} when the entry declares no bindings block.
/* tslint:disable */
/* eslint-disable */

/**
 * A verified PARG artifact exposed to JavaScript: checksum-verified
 * load, native parse, bindings application, embedded-suite runs and
 * the binding-requirements schema (PN 2/4).
 */
export class PargArtifactJs {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Apply an entry's DECLARED bindings artifact (parsanol-ruby#432)
     * to a parsanol-shape tree. The bindings artifact is verified
     * (kind, checksum, `ts` target, binding version) and pair-checked
     * against this parse artifact by grammar source hash before the
     * shared apply core runs.
     */
    applyBindingsArtifact(bindings_json: string, entry: string, shape_json: string): string;
    /**
     * Apply an entry's bindings to a parsanol-shape tree (JSON text).
     */
    applyBindings(entry: string, shape_json: string): string;
    /**
     * Declared entry point names, sorted.
     */
    entryNames(): string[];
    /**
     * Lower the artifact to a constrained-decoder grammar form
     * (`target`: "xgrammar" | "llguidance"); `recovery` lowers each
     * declared resync pattern as an escape alternative at the
     * repetition spine. Rust is the authoritative lowering — TS
     * inherits it through this surface instead of a per-language port.
     */
    export(target: string, recovery: boolean): string;
    /**
     * Emit a render variant against a bound attribute map (rs#459
     * slice 2 — the graduated generation path). `model_json` is the
     * bound map as JSON text (what `parseAndBind` returns). Rust is
     * the authoritative lowering; TS inherits it through this surface
     * instead of a per-language renderer.
     */
    generate(variant: string, model_json: string): string;
    /**
     * Load and checksum-verify an artifact envelope.
     */
    constructor(artifact_json: string);
    /**
     * Parse and bind in one step: the bound attribute hash as JSON.
     *
     * Returns `{}` when the entry declares no `bindings` block — the
     * parse succeeded, there was simply nothing to bind.
     */
    parseAndBind(entry: string, input: string): string;
    /**
     * Best-effort recovery (TODO.sota/1): success returns
     * `{"ok": true, "shape": ...}`; failure returns
     * `{"ok": false, "captures": ..., "error": ..., "consumed_upto"}`.
     */
    parseShapeRecovering(entry: string, input: string): string;
    /**
     * Explicit compatibility without changing parseShape defaults.
     * The JSON envelope contains either shape or causal error diagnostics;
     * it does not claim best-effort recovery captures.
     */
    parseShapeWithCompatibility(entry: string, input: string, compatibility: string): string;
    /**
     * Parse an entry with the native engine; returns the parsanol-shape
     * tree as JSON text.
     */
    parseShape(entry: string, input: string): string;
    /**
     * Run the artifact's embedded tests; returns the failure list as
     * JSON (empty array means green).
     */
    runTests(): string;
    /**
     * The binding-requirements schema as TypeScript source.
     */
    schemaTypescript(): string;
    /**
     * The binding-requirements schema as JSON text.
     */
    schema(): string;
    /**
     * The semantics hash (ruby#377): sha256 over the canonicalized
     * envelope minus the producer set — byte-stable across re-bakes
     * by a newer compiler when the grammar is unchanged. `undefined`
     * on artifacts baked before the field existed.
     */
    semanticsHash(): string | undefined;
}

/**
 * WASM parser instance
 *
 * Create with `new WasmParser(grammarJson)` and parse with `parse(input)`.
 */
export class WasmParser {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Create a new parser from a PARG artifact envelope and entry name.
     *
     * The artifact's canonical checksum is verified before any parsing;
     * a mismatched or corrupt artifact is rejected (PN 2).
     *
     * # Arguments
     * * `artifact_json` - JSON text of the PARG artifact envelope
     * * `entry` - entry point name declared in the artifact
     */
    static fromArtifact(artifact_json: string, entry: string): WasmParser;
    /**
     * Create a new parser from grammar JSON
     *
     * # Arguments
     * * `grammar_json` - JSON string representing the grammar
     *
     * # Returns
     * A new WasmParser instance
     *
     * # Throws
     * If the grammar JSON is invalid
     */
    constructor(grammar_json: string);
    /**
     * Parse input and return JavaScript AST
     *
     * # Arguments
     * * `input` - The input string to parse
     *
     * # Returns
     * A JavaScript object representing the parsed AST
     *
     * # Throws
     * If parsing fails
     */
    parse(input: string): any;
    /**
     * Parse and return flat array (for Opal compatibility)
     *
     * # Arguments
     * * `input` - The input string to parse
     *
     * # Returns
     * A Uint32Array containing the flattened AST
     *
     * # Throws
     * If parsing fails
     */
    parse_flat(input: string): BigUint64Array;
    /**
     * Parse and return JSON string
     *
     * # Arguments
     * * `input` - The input string to parse
     *
     * # Returns
     * A JSON string representing the parsed AST
     *
     * # Throws
     * If parsing fails
     */
    parse_json(input: string): string;
}

/**
 * Compile PARG source to a checksummed artifact — the playground's
 * compiler-in-the-browser (site#19). Single-file grammars: `use`
 * imports have no filesystem here and reject with the merge error.
 */
export function compileSource(source: string): string;

/**
 * Install the panic hook (better panic messages in the console).
 *
 * The glue's real bootstrap is the DEFAULT export —
 * `__wbg_init(module_or_path?)` / `initSync` — which calls this on
 * its way up; calling it directly is only needed outside the
 * bootstrap. It is deliberately NOT named `init`: that name in the
 * generated d.ts typed the bootstrap as `() => void` and hid the
 * real signatures (rs#308).
 */
export function setPanicHook(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_pargartifactjs_free: (a: number, b: number) => void;
    readonly __wbg_wasmparser_free: (a: number, b: number) => void;
    readonly compileSource: (a: number, b: number) => [number, number, number, number];
    readonly pargartifactjs_applyBindings: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly pargartifactjs_applyBindingsArtifact: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly pargartifactjs_entryNames: (a: number) => [number, number];
    readonly pargartifactjs_export: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly pargartifactjs_generate: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly pargartifactjs_new: (a: number, b: number) => [number, number, number];
    readonly pargartifactjs_parseAndBind: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly pargartifactjs_parseShape: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly pargartifactjs_parseShapeRecovering: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly pargartifactjs_parseShapeWithCompatibility: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly pargartifactjs_runTests: (a: number) => [number, number, number];
    readonly pargartifactjs_schema: (a: number) => [number, number, number];
    readonly pargartifactjs_schemaTypescript: (a: number) => [number, number, number];
    readonly pargartifactjs_semanticsHash: (a: number) => any;
    readonly parsanol_c_last_error: () => number;
    readonly parsanol_c_parse: (a: bigint, b: number, c: number, d: number) => number;
    readonly parsanol_c_parse_len: (a: bigint, b: number, c: number, d: number, e: number) => number;
    readonly parsanol_c_register: (a: number) => bigint;
    readonly parsanol_c_release: (a: bigint) => void;
    readonly parsanol_grammar_atom_count: (a: number) => number;
    readonly parsanol_grammar_free: (a: number) => void;
    readonly parsanol_grammar_new: (a: number) => number;
    readonly parsanol_grammar_new_with_error: (a: number, b: number) => number;
    readonly parsanol_grammar_root: (a: number) => number;
    readonly parsanol_parg_error: (a: number, b: number) => number;
    readonly parsanol_parg_export: (a: number, b: number, c: number) => number;
    readonly parsanol_parg_free: (a: number) => void;
    readonly parsanol_parg_generate: (a: number, b: number, c: number) => number;
    readonly parsanol_parg_parse: (a: number, b: number) => number;
    readonly parsanol_parg_parse_recovering: (a: number, b: number, c: number) => number;
    readonly parsanol_parg_parse_with_compatibility: (a: number, b: number, c: number, d: number) => number;
    readonly parsanol_parse: (a: number, b: number, c: number) => number;
    readonly parsanol_parse_end_pos: (a: number, b: number) => number;
    readonly parsanol_parse_simple: (a: number, b: number) => number;
    readonly parsanol_result_ast_json: (a: number) => number;
    readonly parsanol_result_end_pos: (a: number) => number;
    readonly parsanol_result_error: (a: number) => number;
    readonly parsanol_result_free: (a: number) => void;
    readonly parsanol_result_success: (a: number) => number;
    readonly parsanol_version: () => number;
    readonly setPanicHook: () => void;
    readonly wasmparser_fromArtifact: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasmparser_new: (a: number, b: number) => [number, number, number];
    readonly wasmparser_parse: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmparser_parse_flat: (a: number, b: number, c: number) => [number, number, number, number];
    readonly parsanol_string_free: (a: number) => void;
    readonly wasmparser_parse_json: (a: number, b: number, c: number) => [number, number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
