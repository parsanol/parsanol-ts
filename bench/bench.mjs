// parsanol-ts throughput bench: artifact load, parse+bind, render.
// Usage: PARG_ARTIFACT_DIR=<artifacts> node bench/bench.mjs [flavor] [iterations]
import { performance } from "node:perf_hooks";
import { PargRuntime } from "../dist/runtime.js";

const flavor = process.argv[2] ?? "iso";
const iterations = Number(process.argv[3] ?? 200);
const dir = process.env.PARG_ARTIFACT_DIR;
if (!dir) {
  console.error("set PARG_ARTIFACT_DIR to the baked artifacts");
  process.exit(1);
}

const t0 = performance.now();
const rt = PargRuntime.load(flavor, undefined, dir);
const loadMs = performance.now() - t0;

const samples = [
  "ISO 5537:2025",
  "ISO/IEC Directives Part 2:2021",
  "ISO 124:1984",
  "ISO/IEC Guide 2:2004",
];

const t1 = performance.now();
let ok = 0;
for (let i = 0; i < iterations; i++) {
  for (const input of samples) {
    const bound = rt.parseAndBind(input);
    if (bound !== null) ok += 1;
  }
}
const parseMs = performance.now() - t1;

const t2 = performance.now();
for (let i = 0; i < iterations; i++) {
  for (const input of samples) rt.renderString(input);
}
const renderMs = performance.now() - t2;

const total = iterations * samples.length;
console.log(`flavor=${flavor} load=${loadMs.toFixed(1)}ms`);
console.log(
  `parse_and_bind: ${total} inputs in ${parseMs.toFixed(1)}ms ` +
  `(${((total / parseMs) * 1000).toFixed(0)}/s, ${ok} non-null)`,
);
console.log(
  `render_string:  ${total} inputs in ${renderMs.toFixed(1)}ms ` +
  `(${((total / renderMs) * 1000).toFixed(0)}/s)`,
);
