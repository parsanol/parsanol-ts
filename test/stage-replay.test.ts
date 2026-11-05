import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalEqual,
  dumpCanonical,
  flattenShape,
  sortCanonical,
} from "../src/stage-canonical.js";
import { formatReport, replayStage } from "../scripts/replay-stage.js";

const ref = (offset: number, value: string) => ({ offset, length: Buffer.byteLength(value), line: 1, column: offset + 1, value });

describe("stage canonical form (latexmath stage_cases.rb Canonical.dump)", () => {
  it("dumps hashes, symbols, slices with byte and char offsets", () => {
    const source = "x^2";
    const tree = { power: { supscript: { number: ref(2, "2") }, symbols: ref(0, "x") } };
    assert.deepEqual(dumpCanonical(tree, { source }), {
      hash: [[
        { sym: "power" },
        {
          hash: [
            [{ sym: "supscript" }, { hash: [[{ sym: "number" }, { slice: "2", byte_offset: 2, char_offset: 2 }]] }],
            [{ sym: "symbols" }, { slice: "x", byte_offset: 0, char_offset: 0 }],
          ],
        },
      ]],
    });
  });

  it("counts char offsets in code points over UTF-8 bytes", () => {
    const source = "αβx";
    const canonical = dumpCanonical({ symbols: { offset: 4, length: 1 } }, { source });
    assert.deepEqual(canonical, { hash: [[{ sym: "symbols" }, { slice: "x", byte_offset: 4, char_offset: 2 }]] });
  });

  it("writes renamed captures as string keys, arrays and nil", () => {
    const canonical = dumpCanonical(
      { row_break: ref(0, "\\\\"), expression: [null] },
      { source: "\\\\", renames: { row_break: "\\\\" } },
    );
    assert.deepEqual(canonical, {
      hash: [
        [{ str: "\\\\" }, { slice: "\\\\", byte_offset: 0, char_offset: 0 }],
        [{ sym: "expression" }, { array: [{ nil: true }] }],
      ],
    });
  });

  it("flattens v2 TaggedArray nodes", () => {
    assert.deepEqual(flattenShape({ tag: "repetition", items: [{ a: null }, { a: null }] }), [{ a: null }, { a: null }]);
    assert.equal(flattenShape({ tag: "maybe", items: [] }), null);
    assert.deepEqual(flattenShape({ tag: "sequence", items: [{ a: null }, { b: null }] }), { a: null, b: null });
  });

  it("compares hashes ignoring pair order", () => {
    const a = { hash: [[{ sym: "a" }, { str: "1" }], [{ sym: "b" }, { str: "2" }]] };
    const b = { hash: [[{ sym: "b" }, { str: "2" }], [{ sym: "a" }, { str: "1" }]] };
    assert.ok(canonicalEqual(a, b));
    assert.deepEqual(sortCanonical(a), sortCanonical(b));
    assert.ok(!canonicalEqual(a, { hash: [[{ sym: "a" }, { str: "1" }]] }));
  });
});

describe("stage replay on the wasm engine", () => {
  it("replays a raw-tree generation with no differing rows when provided", () => {
    // artifact-gated: PARG_ARTIFACT_DIR holds latex.json and
    // STAGE_PAYLOADS is the generation's payloads directory.
    const dir = process.env.PARG_ARTIFACT_DIR;
    const payloads = process.env.STAGE_PAYLOADS;
    if (!dir || !payloads) return;
    const artifact = join(dir, process.env.STAGE_ARTIFACT ?? "latex.json");
    if (!existsSync(artifact)) return;
    const report = replayStage({ artifact, payloads });
    assert.ok(report.rows.length > 0, "no raw-tree rows found");
    assert.equal(report.differ, 0, formatReport(report));
  });
});
