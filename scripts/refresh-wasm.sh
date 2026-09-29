#!/usr/bin/env bash
# Rebuild the vendored wasm from parsanol-rs main and update BUILT_FROM.
# Requires wasm-pack 0.13.x (--target=nodejs) and rustup's wasm target.
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
RS="${PARSANOL_RS:-$HERE/../parsanol-rs}"

export PATH="$HOME/.cargo/bin:$PATH"
cd "$RS/parsanol"
rm -rf pkg
wasm-pack build --release --target=nodejs --features wasm

# The glue ships as CommonJS under this package's "type": "module".
cp pkg/parsanol_bg.wasm pkg/parsanol_bg.wasm.d.ts pkg/parsanol.d.ts \
   "$HERE/vendor/parsanol-wasm/"
cp pkg/parsanol.js "$HERE/vendor/parsanol-wasm/parsanol.cjs"
rm -f "$HERE/vendor/parsanol-wasm/parsanol.js"
git -C "$RS" rev-parse HEAD > "$HERE/vendor/parsanol-wasm/BUILT_FROM"
echo "built with: wasm-pack build --target=nodejs --features wasm (from parsanol-rs/parsanol)" \
  >> "$HERE/vendor/parsanol-wasm/BUILT_FROM"
echo "vendored $(head -1 "$HERE/vendor/parsanol-wasm/BUILT_FROM" | cut -c1-12)"
