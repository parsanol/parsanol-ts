/** A native rule-recursion resource guard, distinct from syntax refusal. */
export class RecursionLimitExceeded extends Error {
    depth;
    maxDepth;
    category = "recursion_limit";
    constructor(depth, maxDepth, message) {
        super(message ?? `Recursion limit exceeded: depth ${depth}, limit ${maxDepth}`);
        this.depth = depth;
        this.maxDepth = maxDepth;
        this.name = "RecursionLimitExceeded";
    }
}
/** WASM VM-call budget, separate from the rule-reference recursion guard. */
export class CallDepthLimitExceeded extends Error {
    depth;
    maxDepth;
    category = "call_depth_limit";
    constructor(depth, maxDepth, message) {
        super(message ?? `VM call depth exceeded: depth ${depth}, limit ${maxDepth}`);
        this.depth = depth;
        this.maxDepth = maxDepth;
        this.name = "CallDepthLimitExceeded";
    }
}
function nativeResource(value) {
    if (value === null || typeof value !== "object")
        return null;
    const wire = value;
    if (typeof wire["depth"] !== "number" || typeof wire["max_depth"] !== "number")
        return null;
    const message = typeof wire["message"] === "string" ? wire["message"] : undefined;
    if (wire["category"] === "recursion_limit")
        return new RecursionLimitExceeded(wire["depth"], wire["max_depth"], message);
    if (wire["category"] === "call_depth_limit")
        return new CallDepthLimitExceeded(wire["depth"], wire["max_depth"], message);
    return null;
}
function rethrowNative(error) { throw nativeResource(error) ?? error; }
/**
 * A loaded, checksum-verified PG artifact with its schema.
 * Construction throws when the checksum does not verify.
 */
export class PargRuntimeCore {
    artifact;
    schema;
    renderSpec;
    entry;
    defaultEntry;
    /** parsanol-ts#5 provenance: SHA-256 of the .parg source text and the
     * compiler version. Null for artifacts compiled before these fields
     * existed (unverifiable, not stale). */
    sourceHash;
    compilerVersion;
    source;
    /** ruby#377 semantics fingerprint: stable across producer metadata
     * (compiler_version, unicode_tables), so gates can tell "re-baked by
     * a newer compiler" from "the grammar changed". Null for artifacts
     * baked before the field existed (parsanol >= 1.3.117 / rs 0.19.14). */
    semanticsHash;
    envelope;
    constructor(artifactJson, entry, engine) {
        const parsed = JSON.parse(artifactJson);
        this.envelope = parsed;
        // Dynamic artifacts (parsanol-ruby#129 runtime state / custom atoms)
        // carry Ruby closures; their grammars deserialize portably but parse
        // only on a Ruby runtime. Fail here, at the boundary, with the
        // routing answer instead of a wasm deserialization error deep in the
        // atom tree.
        if (parsed["dynamic"] === true) {
            throw new Error("this artifact uses PARG runtime state or custom atoms and parses " +
                "only on a Ruby runtime (parsanol-ruby#129)");
        }
        this.artifact = new (engine().PargArtifactJs)(artifactJson);
        this.schema = JSON.parse(this.artifact.schema());
        this.renderSpec =
            parsed["render"] ?? {};
        // The compiler bakes default_entry: JSON key order is not preserved
        // across engines, so the sorted entry list cannot rederive it.
        this.defaultEntry = parsed["default_entry"] ?? null;
        this.sourceHash = parsed["source_hash"] ?? null;
        this.compilerVersion = parsed["compiler_version"] ?? null;
        this.source = parsed["source"] ?? null;
        this.semanticsHash = parsed["semantics_hash"] ?? null;
        this.entry = entry ?? this.defaultEntry ?? this.artifact.entryNames()[0];
    }
    /** The wire-format family ("parsanol-tree/v2"): a shape bump requires a
     * new engine family; same-shape artifacts parse identically forever. */
    get shape() {
        return this.envelope["shape"] ?? null;
    }
    /** Parse with the native wasm engine; returns the parsanol-shape tree. */
    parseShape(input) {
        try {
            return JSON.parse(this.artifact.parseShape(this.entry, input));
        }
        catch (error) {
            return rethrowNative(error);
        }
    }
    /** Explicit historical memo/causal-diagnostic policy; old APIs remain strict.
     * This is a parse result, not a best-effort recovery capture envelope. */
    parseShapeWithCompatibility(input, compatibility) {
        if (typeof this.artifact.parseShapeWithCompatibility !== "function") {
            throw new Error("native engine does not expose explicit parsing compatibility");
        }
        try {
            const result = JSON.parse(this.artifact.parseShapeWithCompatibility(this.entry, input, compatibility));
            const resource = nativeResource(result?.error);
            if (resource)
                throw resource;
            return result;
        }
        catch (error) {
            return rethrowNative(error);
        }
    }
    /**
     * Best-effort recovery (TODO.sota/1): never throws. Success returns
     * `{ ok: true, shape }`; failure returns
     * `{ ok: false, captures, error, consumed_upto }` — the captures
     * observed before the failure plus the failure wire.
     */
    parseShapeRecovering(input) {
        try {
            return JSON.parse(this.artifact.parseShapeRecovering(this.entry, input));
        }
        catch (error) {
            return rethrowNative(error);
        }
    }
    /** Apply the entry's bindings to a parsanol-shape tree. */
    applyBindings(shape) {
        return JSON.parse(this.artifact.applyBindings(this.entry, JSON.stringify(shape)));
    }
    /** Apply an entry's DECLARED bindings artifact (parsanol-ruby#432) to
     * a parsanol-shape tree. The engine verifies the artifact (kind,
     * canonical-JSON checksum, `ts` target pin, binding version) and
     * pair-checks it against this artifact by grammar source hash before
     * the shared apply core runs — the JSON materialized is the JSON the
     * checksum pinned. */
    applyBindingsArtifact(bindingsJson, shape) {
        return JSON.parse(this.artifact.applyBindingsArtifact(bindingsJson, this.entry, JSON.stringify(shape)));
    }
    /** Parse and bind in one step. */
    parseAndBind(input) {
        try {
            return JSON.parse(this.artifact.parseAndBind(this.entry, input));
        }
        catch {
            return null;
        }
    }
    /**
     * Schema-driven materialization: the schema (from the artifact, not
     * hand-written model code) declares the fields a data model must
     * implement; the bound captures populate a structurally-typed object.
     * Card `1*`/`*` fields become arrays; `0..1` fields become nullable.
     */
    materialize(input) {
        const bound = this.parseAndBind(input);
        if (bound === null)
            return null;
        const schema = this.schema[this.entry];
        if (!schema)
            throw new Error(`artifact has no schema for entry ${this.entry}`);
        return materializeFromSchema(schema, bound);
    }
    /** Render the identifier string from a bound map (F6). */
    render(bound, variant = "default") {
        return renderSegments((this.renderSpec[variant] ?? null), bound);
    }
    /** Parse, bind, and render in one step. */
    renderString(input, variant = "default") {
        const bound = this.parseAndBind(input);
        return bound === null ? null : this.render(bound, variant);
    }
    /** Evaluate a named derive spec against a bound map (F6). */
    derive(name, bound) {
        return deriveTemplate((this.envelope["derive"] ?? {}), name, bound);
    }
    /** Parse, bind, and evaluate a derive spec in one step. */
    deriveString(input, name) {
        const bound = this.parseAndBind(input);
        return bound === null ? null : this.derive(name, bound);
    }
    /** Run the artifact's embedded tests; empty list means green. */
    runTests() {
        return JSON.parse(this.artifact.runTests());
    }
}
/** F6 v1 derive evaluator: {field} interpolates from the bound map. */
export function deriveTemplate(derive, name, bound) {
    const template = derive[name];
    if (template === undefined)
        throw new Error(`derive spec ${name} not declared`);
    return template.replace(/\{(\w+)\}/g, (_, field) => {
        const value = bound[field];
        return value === undefined || value === null ? "" : String(value);
    });
}
/** F6 v1 generic renderer: field / literal / cond-presence segments. */
export function renderSegments(segments, bound) {
    let out = "";
    for (const segment of segments ?? []) {
        if (segment.type === "field") {
            const value = bound[segment.field];
            out += value === undefined || value === null ? "" : String(value);
        }
        else if (segment.type === "literal") {
            out += segment.text;
        }
        else if (segment.type === "cond") {
            const value = bound[segment.field];
            if (value !== undefined && value !== null)
                out += renderSegments(segment.then, bound);
        }
    }
    return out;
}
/**
 * Schema-driven materialization independent of any wasm handle —
 * the same function the model layer will build on (T2 codegen emits the
 * static view of exactly these fields).
 */
export function materializeFromSchema(schema, bound) {
    const attributes = {};
    for (const [path, requirements] of Object.entries(schema.fields)) {
        const leaf = path.includes("[]")
            ? (path.split("].").pop() ?? path)
            : path;
        const value = bound[leaf];
        if (requirements.card.endsWith("*")) {
            const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
            attributes[leaf] = list;
        }
        else if (requirements.card === "0..1") {
            attributes[leaf] = value === undefined ? null : value;
        }
        else {
            attributes[leaf] = value;
        }
    }
    return { entry: schema.root, attributes };
}
