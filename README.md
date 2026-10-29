# parsanol

The PARG artifact runtime for TypeScript: load a checksum-verified
`.parg` artifact, parse through the parsanol wasm engine, apply the
artifact's bindings, and materialize schema-driven models.

The engine is the vendored parsanol wasm build (`vendor/parsanol-wasm/`,
nodejs target) — **no grammar code lives here**; the baked artifact is
the contract.

## Releases

parsanol is one product on three language runtimes: **ruby** (rubygems),
**python** (PyPI, `parsanol`), and **typescript** (npm, `parsanol` —
this package). Every release publishes **all three together**; a release
that ships one runtime and not the others is incomplete.

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
