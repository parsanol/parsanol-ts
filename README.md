# parsanol

The PARG artifact runtime for TypeScript: load a checksum-verified
`.parg` artifact, parse through the parsanol wasm engine, apply the
artifact's bindings, and materialize schema-driven models.

The engine is the vendored parsanol wasm build (`vendor/parsanol-wasm/`,
nodejs target) — **no grammar code lives here**; the baked artifact is
the contract.

## Releases

parsanol is one product on **four runtimes**: **rs** (crates.io +
`@parsanol/wasm` + release binaries), **ruby** (rubygems), **python**
(PyPI, `parsanol`), and **typescript** (npm, `parsanol` — this package).
**Every engine update releases all four together**; a release that ships
some runtimes and not the rest is incomplete.

## Usage

```ts
import { PargRuntime } from "parsanol";

// PARG_ARTIFACT_DIR (or an explicit dir) holds the baked artifacts.
const rt = PargRuntime.load("iso", undefined, process.env.PARG_ARTIFACT_DIR);

const bound = rt.parseAndBind("ISO 5537:2025");   // bound capture map
const shape = rt.parseShape("ISO 5537:2025");     // parsanol-shape tree
const text = rt.renderString("ISO 5537:2025");    // F6 render
```

Construction throws unless the artifact's embedded checksum verifies.

## Provenance

Every artifact embeds its provenance; the runtime exposes and verifies
it (parsanol-ts#5):

```ts
rt.sourceHash;                    // SHA-256 of the .parg source (bare hex)
rt.compilerVersion;               // the compiler that produced the artifact
rt.source;                        // the embedded .parg source text
rt.shape;                         // wire-format family, "parsanol-tree/v2"
rt.compiledFrom(currentSource);   // false = the artifact is stale
```

A stale artifact (`compiledFrom` false against the current grammar text)
means the source moved since compilation — recompile or fall back.
`shape` moves independently of `compilerVersion`: the same
`parsanol-tree/v2` artifact parses identically on every engine, forever;
a shape bump means a new engine family.

## Recovery (best-effort partial parses)

`parseShapeRecovering` never throws: on success it returns
`{ ok: true, shape }`; on failure it returns the "what did match"
answer alongside the failure —

```ts
const r = rt.parseShapeRecovering("ab 4");
// { ok: false,
//   error: { offset: 4, expected: [...] },
//   captures: { text: [{ value: "ab", offset: 0, ... }] },
//   consumed_upto: 4 }
```

- `captures` carries every capture observed before the failure
  (best-effort: it may include captures from branches that later
  failed — same semantics as the rs recovery journal).
- `consumed_upto` is the furthest position any successful match ended.

The strict `parseShape` contract is unchanged; recovery is the
editors-and-linters answer.

## Vendored engine freshness

`vendor/parsanol-wasm/BUILT_FROM` records the parsanol-rs commit the
wasm was built from; `scripts/check-wasm-freshness.sh` fails when
parsanol-rs has moved. Refresh with `npm run refresh-wasm`.

## Conformance

`PargRuntime` parses with the same wasm binary the Rust and Ruby
engines validate against, so artifact-level conformance is inherited:
any baked artifact that passes its embedded tests on the other engines
passes here identically. Run the runtime tests with
`PARG_ARTIFACT_DIR=<artifacts> npm test` (the artifact-gated case
skips when no artifacts dir is set).

## Browser runtime

The browser entry uses the official `@parsanol/wasm` web build shipped with
this package. It fetches WASM relative to the generated web module.

```ts
import initialize, { PargRuntime } from "parsanol/browser";
await initialize();
const parser = await PargRuntime.fromURL("/artifacts/example.json");
const shape = parser.parseShape("input");
```

To provide your own WASM location or bytes, pass them to `initialize`. A
synchronous constructor requires initialization first. Pass original artifact
and binding JSON text unchanged; parsing and reserializing checksum-bound
resources can change their numeric representations.

The browser entry has HTTP `fromURL` instead of Node filesystem helpers. Its
`compiledFrom(source)` uses asynchronous WebCrypto: `await` its result. The
Node entry retains its synchronous API. Browser-aware package resolution also
selects this entry; the explicit `/browser` import supplies its browser types.

`npm run test:browser` checks the packed package in real Chrome/Chromium,
including native parsing, compiler agreement, recovery, artifact verification,
and HTTP failures. Set `CHROME_BIN` to an existing browser if needed.
`npm run refresh-web-wasm -- 0.20.12` reproduces the vendored browser assets
from the pinned official npm release; keep its version aligned with the Node
engine. No Rust build or Node polyfill runs in the browser.

Parser resource guards are distinct from syntax refusals. The WASM engine keeps
its 1000 rule-reference recursion budget and additionally limits simultaneous VM
atom calls to 1024, before the host call stack can throw and strand a borrow.
`RecursionLimitExceeded` and `CallDepthLimitExceeded` expose `category`, `depth`
and `maxDepth`. These budgets count engine calls, not parentheses in user input.
A resource abort leaves the artifact reusable and freeable. Generic VM/host errors
retain their original type; they are never relabeled as a depth error.
