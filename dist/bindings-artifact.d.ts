export declare const BINDINGS_ARTIFACT_KIND = "parg-bindings";
export declare const BINDING_TARGETS: readonly ["ruby", "rs", "ts", "python"];
export type BindingTarget = (typeof BINDING_TARGETS)[number];
export interface BindingRecord {
    capture: string;
    path: string;
    type: string;
    card: string | null;
    preprocess: string | null;
}
export interface BindingsArtifactPayload {
    artifact_kind: string;
    target: BindingTarget;
    binding_version: number;
    grammar: string;
    grammar_version: string;
    grammar_source_hash: string;
    shape: string;
    entries: Record<string, {
        bindings: BindingRecord[];
    }>;
    checksum: string;
}
/** Structural parse of a declared bindings artifact. Throws with the
 * verification duty named when the payload is not an object, declares a
 * foreign kind or an unknown target, or when the caller pinned a
 * different target. Checksum verification rides the engine (see
 * `PargRuntime.applyBindingsArtifact`). */
export declare function parseBindingsArtifact(json: string, expectedTarget?: BindingTarget): BindingsArtifactPayload;
