// Types for the `parsanol/wasm` subpath: the web-target engine binary.
// A bundler that imports wasm as a module (wrangler/esbuild in a Cloudflare
// Worker) gives the compiled module as the default import; pass it to
// `initialize` from `parsanol/browser`.
declare const wasm: WebAssembly.Module;
export default wasm;
