#!/usr/bin/env bash
# Fails when the vendored parsanol wasm no longer matches the parsanol-rs
# checkout it must track. The vendor dir's BUILT_FROM.json records the rs
# commit the current wasm was built from (source_commit); when parsanol-rs
# moves, re-vendor (npm run refresh-web-wasm) and commit the new wasm
# together with the record.
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
VENDOR="$HERE/../vendor/parsanol-web"
RS_DIR="${PARSANOL_RS:-$HERE/../../parsanol-rs}"

if [ ! -f "$VENDOR/BUILT_FROM.json" ]; then
  echo "wasm-freshness: FAIL — $VENDOR/BUILT_FROM.json is missing" >&2
  exit 1
fi

built_from="$(node -p 'require(process.argv[1]).source_commit' "$VENDOR/BUILT_FROM.json")"
if [ ! -d "$RS_DIR/.git" ]; then
  echo "wasm-freshness: SKIP — parsanol-rs checkout not found at $RS_DIR"
  exit 0
fi
rs_head="$(git -C "$RS_DIR" rev-parse HEAD)"
kind="$(node -p 'require(process.argv[1]).kind ?? "release"' "$VENDOR/BUILT_FROM.json")"
# A tested CI build of an open parsanol-rs pull request is not on any
# branch the checkout fetched; name it by SHA so the gate can see it.
if ! git -C "$RS_DIR" cat-file -e "$built_from^{commit}" 2>/dev/null; then
  git -C "$RS_DIR" fetch -q origin "$built_from" || true
fi

# Fresh = built from a commit that shares history with the rs checkout
# (either is an ancestor of the other). An exact-HEAD compare failed
# on every parsanol-rs merge commit even when the vendored wasm
# contained everything current - the corpus PR own merge commit tripped
# it in CI.
if git -C "$RS_DIR" merge-base --is-ancestor "$built_from" "$rs_head"; then
  echo "wasm-freshness: ok (built from ${built_from:0:12}, contained in ${rs_head:0:12})"
  exit 0
fi
if git -C "$RS_DIR" merge-base --is-ancestor "$rs_head" "$built_from"; then
  echo "wasm-freshness: ok (built from ${built_from:0:12}, ahead of ${rs_head:0:12})"
  exit 0
fi
# A CI test build (not a release) of an unmerged parsanol-rs commit is
# allowed while its pull request is open, as long as the commit exists
# upstream; the release refresh replaces it with a merged build.
if [ "$kind" = "ci-test-build-not-release" ] && git -C "$RS_DIR" cat-file -e "$built_from^{commit}" 2>/dev/null; then
  echo "wasm-freshness: ok (CI test build of unmerged ${built_from:0:12}; parsanol-rs is at ${rs_head:0:12})"
  exit 0
fi
echo "wasm-freshness: FAIL — vendored wasm built from ${built_from:0:12} which has diverged from parsanol-rs ${rs_head:0:12}." >&2
echo "  Re-vendor with npm run refresh-web-wasm and commit BUILT_FROM.json." >&2
exit 1
