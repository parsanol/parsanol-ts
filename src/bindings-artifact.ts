//! The declared per-target binding artifact (parsanol-ruby#432): from
//! one compiled grammar the toolchain emits one checksummed bindings
//! artifact per target, pinned to its grammar by source hash. Declared
//! and diffable, not baked.
//!
//! Boundary: the records carry AST construction only — the
//! production-to-binding mapping. Semantics live in the model layer
//! (LML). Full verification (kind, canonical-JSON checksum, target pin,
//! binding version) and pairing (grammar / version / source hash)
//! happen in the ENGINE — `PargRuntime.applyBindingsArtifact` on the
//! paired artifact — so the JSON the engine materializes is the JSON
//! the checksum pinned; this module adds only the structural parse and
//! the typed surface.

export const BINDINGS_ARTIFACT_KIND = "parg-bindings";

export const BINDING_TARGETS = ["ruby", "rs", "ts", "python"] as const;

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
  entries: Record<string, { bindings: BindingRecord[] }>;
  checksum: string;
}

/** Structural parse of a declared bindings artifact. Throws with the
 * verification duty named when the payload is not an object, declares a
 * foreign kind or an unknown target, or when the caller pinned a
 * different target. Checksum verification rides the engine (see
 * `PargRuntime.applyBindingsArtifact`). */
export function parseBindingsArtifact(
  json: string,
  expectedTarget?: BindingTarget,
): BindingsArtifactPayload {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch (error) {
    throw new Error(`bindings artifact is not valid JSON: ${String(error)}`);
  }
  const object = payload as Record<string, unknown>;
  if (object["artifact_kind"] !== BINDINGS_ARTIFACT_KIND) {
    throw new Error(
      `not a ${BINDINGS_ARTIFACT_KIND} artifact (artifact_kind ${JSON.stringify(
        object["artifact_kind"],
      )})`,
    );
  }
  const target = object["target"] as BindingTarget;
  if (!BINDING_TARGETS.includes(target)) {
    throw new Error(`unknown binding target ${JSON.stringify(target)}`);
  }
  if (expectedTarget !== undefined && target !== expectedTarget) {
    throw new Error(
      `bindings artifact targets ${JSON.stringify(target)}, not ${JSON.stringify(expectedTarget)}`,
    );
  }
  if (typeof object["entries"] !== "object" || object["entries"] === null) {
    throw new Error("bindings artifact carries no entries map");
  }
  return payload as BindingsArtifactPayload;
}
