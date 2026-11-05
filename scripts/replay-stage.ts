//! Replays a plurimath-testsuite stage generation's raw-tree rows on the
//! wasm engine and compares them with the Ruby-produced expectations
//! (plurimath#540, requirement 3: per-target replay).
//!
//!   node dist-test/scripts/replay-stage.js <artifact.json> <payloads> [options]
//!
//! <payloads> is a payload file or a directory of raw-*.yaml payloads
//! (schema plurimath-stage/<language>/cases/1, boundary raw-tree).
//!
//! Options:
//!   --bindings PATH   declared bindings artifact (default: the artifact's
//!                     sibling <name>.bindings.ts.json when present)
//!   --capture NAME    the bound capture that holds the tree (latex_tree)
//!   --json PATH       also write the full report as JSON
//!
//! Each row parses `expected.preprocessed.str` (preprocessing is Ruby
//! code; the generation records its output), not the caller input. A row
//! the generation records as a refusal carries no preprocessed text, so
//! its caller input is parsed and the outcome compared by category; the
//! refusal byte offset is in the caller's input on the Ruby side and is
//! reported, not compared. Exit status 1 when any row differs.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { PargRuntime } from "../src/runtime.js";
import {
  type Canonical,
  canonicalEqual,
  dumpCanonical,
  refusal,
  sortCanonical,
} from "../src/stage-canonical.js";

/** latexmath's Configuration: decimal marker -> artifact entry. */
export const LATEX_DECIMAL_ENTRIES: Record<string, string> = {
  ".": "dot",
  ",": "comma",
  "٫": "arabic",
};

/** latexmath's CAPTURE_RENAMES: the PARG capture -> the legacy key. */
export const LATEX_CAPTURE_RENAMES: Record<string, string> = { row_break: "\\\\" };

export interface ReplayOptions {
  artifact: string;
  payloads: string;
  bindings?: string | null;
  capture?: string;
  decimalEntries?: Record<string, string>;
  renames?: Record<string, string>;
}

export interface ReplayRow {
  payload: string;
  id: string;
  input: string;
  parsed: string;
  status: "equal" | "differ";
  reason?: string;
  expected: unknown;
  actual: unknown;
  /** For a refusal row: the wasm offset in the parsed text and the
   * generation's offset in the caller input. */
  refusalOffsets?: { wasm: number | null; expected: number | null };
}

export interface ReplayReport {
  artifact: string;
  compilerVersion: string | null;
  bindings: string | null;
  rows: ReplayRow[];
  equal: number;
  differ: number;
}

interface PayloadCase {
  id: string;
  input: { str?: string };
  options?: { decimal?: string };
  expected: {
    preprocessed?: { str?: string };
    tree?: unknown;
    refusal?: { category: string; byte_offset: number | null };
  };
}

/** The payload files: one file, or a directory's raw-*.yaml in byte order. */
export function payloadFiles(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path)
    .filter((f) => f.startsWith("raw-") && f.endsWith(".yaml"))
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
    .map((f) => join(path, f));
}

function defaultBindings(artifact: string): string | null {
  const candidate = join(dirname(artifact), `${basename(artifact, ".json")}.bindings.ts.json`);
  return existsSync(candidate) ? candidate : null;
}

// The wasm parse failure names its byte offset: "Parse failed at offset N".
function failureOffset(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = /offset (\d+)/.exec(message);
  return match ? Number(match[1]) : null;
}

export function replayStage(options: ReplayOptions): ReplayReport {
  const capture = options.capture ?? "latex_tree";
  const entries = options.decimalEntries ?? LATEX_DECIMAL_ENTRIES;
  const renames = options.renames ?? LATEX_CAPTURE_RENAMES;
  const bindingsPath = options.bindings === undefined ? defaultBindings(options.artifact) : options.bindings;
  const bindingsJson = bindingsPath ? readFileSync(bindingsPath, "utf8") : null;

  const runtimes = new Map<string, PargRuntime>();
  const artifactJson = readFileSync(options.artifact, "utf8");
  const runtimeFor = (entry: string): PargRuntime => {
    let rt = runtimes.get(entry);
    if (!rt) {
      rt = new PargRuntime(artifactJson, entry);
      runtimes.set(entry, rt);
    }
    return rt;
  };
  const first = runtimeFor(entries["."] ?? Object.values(entries)[0]);

  const rows: ReplayRow[] = [];
  for (const file of payloadFiles(options.payloads)) {
    const doc = parseYaml(readFileSync(file, "utf8")) as { boundary?: string; cases?: PayloadCase[] };
    if (doc.boundary !== "raw-tree") continue;
    for (const row of doc.cases ?? []) {
      const decimal = row.options?.decimal ?? ".";
      const entry = entries[decimal];
      if (!entry) throw new Error(`${row.id}: no entry for decimal marker ${JSON.stringify(decimal)}`);
      const rt = runtimeFor(entry);
      const input = row.input.str ?? "";
      const isRefusal = row.expected.refusal !== undefined;
      const text = isRefusal ? input : row.expected.preprocessed?.str;
      if (text === undefined) throw new Error(`${row.id}: expected neither a preprocessed text nor a refusal`);

      let actual: Canonical;
      let wasmOffset: number | null = null;
      try {
        let tree: unknown = rt.parseShape(text);
        if (bindingsJson) tree = rt.applyBindingsArtifact(bindingsJson, tree);
        const bound = tree as Record<string, unknown>;
        if (bound === null || typeof bound !== "object" || !(capture in bound)) {
          throw new Error(`${row.id}: the tree has no ${capture} capture`);
        }
        actual = dumpCanonical(bound[capture], { source: text, renames });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith(`${row.id}:`)) throw error;
        wasmOffset = failureOffset(error);
        actual = refusal(wasmOffset);
      }

      const out: ReplayRow = {
        payload: basename(file),
        id: row.id,
        input,
        parsed: text,
        status: "equal",
        expected: isRefusal ? { refusal: row.expected.refusal } : row.expected.tree,
        actual: sortCanonical(actual),
      };
      if (isRefusal) {
        const expectedOffset = row.expected.refusal?.byte_offset ?? null;
        out.refusalOffsets = { wasm: wasmOffset, expected: expectedOffset };
        if (!("refusal" in actual)) {
          out.status = "differ";
          out.reason = "the generation refuses, wasm parsed";
        } else if (row.expected.refusal?.category !== "parse_error") {
          out.status = "differ";
          out.reason = `refusal category ${row.expected.refusal?.category}`;
        }
      } else if ("refusal" in actual) {
        out.status = "differ";
        out.reason = "the generation parsed, wasm refused";
      } else if (!canonicalEqual(actual, row.expected.tree)) {
        out.status = "differ";
        out.reason = "trees differ";
      }
      rows.push(out);
    }
  }
  const differ = rows.filter((r) => r.status === "differ").length;
  return {
    artifact: options.artifact,
    compilerVersion: first.compilerVersion,
    bindings: bindingsPath,
    rows,
    equal: rows.length - differ,
    differ,
  };
}

/** The report as text: one line per differing row with both trees. */
export function formatReport(report: ReplayReport): string {
  const lines = [
    `artifact ${report.artifact} (compiler ${report.compilerVersion ?? "unknown"})`,
    `bindings ${report.bindings ?? "none (raw shape)"}`,
    `${report.rows.length} rows: ${report.equal} equal, ${report.differ} differ`,
  ];
  for (const row of report.rows.filter((r) => r.status === "differ")) {
    lines.push(
      `DIFFER ${row.payload} ${row.id}: ${row.reason}`,
      `  input:    ${JSON.stringify(row.input)}`,
      `  parsed:   ${JSON.stringify(row.parsed)}`,
      `  expected: ${JSON.stringify(sortCanonical(row.expected))}`,
      `  actual:   ${JSON.stringify(row.actual)}`,
    );
  }
  const offsets = report.rows.filter(
    (r) => r.refusalOffsets && r.refusalOffsets.wasm !== r.refusalOffsets.expected,
  );
  if (offsets.length > 0) {
    lines.push(`refusal offsets not compared (caller input vs grammar input), ${offsets.length} differ:`);
    for (const r of offsets) {
      lines.push(`  ${r.id}: wasm ${r.refusalOffsets?.wasm} in ${JSON.stringify(r.parsed)}, generation ${r.refusalOffsets?.expected}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function main(argv: string[]): number {
  const positional: string[] = [];
  const opts: Partial<ReplayOptions> & { json?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--bindings") opts.bindings = argv[++i];
    else if (arg === "--capture") opts.capture = argv[++i];
    else if (arg === "--json") opts.json = argv[++i];
    else positional.push(arg);
  }
  if (positional.length !== 2) {
    process.stderr.write("usage: replay-stage <artifact.json> <payload file or dir> [--bindings PATH] [--capture NAME] [--json PATH]\n");
    return 2;
  }
  const report = replayStage({ ...opts, artifact: positional[0], payloads: positional[1] });
  process.stdout.write(formatReport(report));
  if (opts.json) writeFileSync(opts.json, `${JSON.stringify(report, null, 2)}\n`);
  return report.differ === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
