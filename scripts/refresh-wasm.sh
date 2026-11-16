#!/usr/bin/env bash
# Rebuild the vendored web-target wasm from a parsanol-rs checkout.
# Requires wasm-pack 0.13.x and rustup's wasm target. Record provenance in
# vendor/parsanol-web/BUILT_FROM.json (source_commit and file digests).
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
RS="${PARSANOL_RS:-$HERE/../parsanol-rs}"

export PATH="$HOME/.cargo/bin:$PATH"
cd "$RS/parsanol"
rm -rf pkg
wasm-pack build --release --target=web --features wasm

cp pkg/parsanol.js pkg/parsanol_bg.wasm pkg/parsanol_bg.wasm.d.ts pkg/parsanol.d.ts \
   "$HERE/vendor/parsanol-web/"
echo "vendored $(git -C "$RS" rev-parse --short=12 HEAD); update vendor/parsanol-web/BUILT_FROM.json"
