# parsanol-ts

The PARG artifact runtime for TypeScript: load a checksum-verified
`.parg` artifact, parse through the parsanol wasm engine, apply the
artifact's bindings, and materialize schema-driven models.

The engine is the vendored parsanol wasm build (`vendor/parsanol-wasm/`,
nodejs target) — **no grammar code lives here**; the baked artifact is
the contract.

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
