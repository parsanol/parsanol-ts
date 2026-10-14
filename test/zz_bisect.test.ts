import { describe, it } from "node:test";
import { PargRuntime } from "../src/runtime.js";

describe("bisect", () => {
  it("field trigger", () => {
    const base: Record<string, unknown> = {
      version: "0.0.0", grammar: "Synthetic", shape: "parsanol-tree/v2", binding_version: 1,
      entries: { identifier: { root: "identifier", grammar: { atoms: [{ Str: { pattern: "ab" } }], root: 0 }, bindings: [] } },
      preprocess: {}, tables: {}, lint: {}, default_entry: "identifier", render: {}, derive: {}, tests: [], docs: {},
      source: "x", compiler_version: "test",
    };
    for (const [label, extra] of [["bare", {}], ["hash", { source_hash: "sha256:aa" }], ["cv", { compiler_version: "t" }], ["both", { source_hash: "sha256:aa", compiler_version: "t" }]] as const) {
      try {
        new PargRuntime(JSON.stringify({ ...base, ...extra }));
        console.log(`BISECT ${label}: OK`);
      } catch (e) {
        console.log(`BISECT ${label}: THROWS ${String(e).slice(0, 90)}`);
      }
    }
  });
});
