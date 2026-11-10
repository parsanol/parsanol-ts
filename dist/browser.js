/** Browser entry backed by the target=web Parsanol engine. */
import initWasm, * as webWasm from "../vendor/parsanol-web/parsanol.js";
import { PargRuntimeCore } from "./runtime-core.js";
export { deriveTemplate, renderSegments, materializeFromSchema, RecursionLimitExceeded, CallDepthLimitExceeded } from "./runtime-core.js";
let initialized = false;
/** Fetch/instantiate the web-target engine; custom bytes, module or URL are supported. */
export async function initialize(input) {
    await initWasm(input === undefined ? undefined : { module_or_path: input });
    initialized = true;
}
export default initialize;
function wasm() {
    if (!initialized)
        throw new Error("Parsanol browser engine is not initialized; await initialize() first");
    return webWasm;
}
/** Compile PARG using the same initialized web engine used for parsing. */
export function compileSource(source) {
    return JSON.parse(wasm().compileSource(source));
}
export class PargRuntime extends PargRuntimeCore {
    constructor(artifactJson, entry) {
        super(artifactJson, entry, wasm);
    }
    /** Source verification uses asynchronous browser WebCrypto, unlike the Node entry. */
    async compiledFrom(source) {
        if (this.sourceHash === null)
            return false;
        if (!globalThis.crypto?.subtle)
            throw new Error("source verification requires WebCrypto in a secure context");
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
        const hex = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
        return this.sourceHash === hex;
    }
    /** Load a checksummed artifact over HTTP; rejects non-success HTTP status. */
    static async fromURL(url, entry) {
        await initialize();
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`artifact fetch failed: HTTP ${response.status}`);
        return new PargRuntime(await response.text(), entry);
    }
}
