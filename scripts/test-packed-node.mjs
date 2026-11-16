// Checks the packed package from a clean consumer: copy this file into a
// directory where the tarball is installed and run it with the Node under
// test. It imports the package specifier and the compiled dist path, and
// parses synchronously through the engine both share.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const byName = await import("parsanol");
const compiled = await import(pathToFileURL(join(here, "node_modules", "parsanol", "dist", "runtime.js")).href);
const suite = await import("parsanol/suite");
assert.equal(byName.PargRuntime, compiled.PargRuntime, "package specifier and dist path load one module");
assert.equal(typeof suite, "object");

const canonical = (value) => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const envelope = {shape:"parsanol-tree/v2",grammar:"PackedProbe",version:"1.0.0",default_entry:"main",
  entries:{main:{root:"main",grammar:{root:6,atoms:[{Str:{pattern:"ab"}},{Str:{pattern:"c"}},
    {Sequence:{atoms:[0,1]}},{Lookahead:{atom:2,positive:false}},{Str:{pattern:"a"}},
    {Str:{pattern:"!"}},{Sequence:{atoms:[3,4,5]}}]}}}};
envelope.checksum = "sha256:" + createHash("sha256").update(JSON.stringify(canonical(envelope))).digest("hex");

const runtime = new byName.PargRuntime(JSON.stringify(envelope));
let shape;
try {
  shape = runtime.parseShape("a!");
  assert.ok(!(shape instanceof Promise), "parseShape stays synchronous");
  assert.deepEqual(runtime.parseShapeWithCompatibility("a!", "parslet"), { ok: true, shape });
  const offsets = ["strict", "parslet"].map((policy) => runtime.parseShapeWithCompatibility("ab?", policy).error.offset);
  assert.deepEqual(offsets, [2, 1]);
  assert.equal(runtime.parseShapeWithReporter("ab?", "parslet", "deepest").error.offset, 2);
  assert.deepEqual(runtime.parseShapeWithReporter("ab?", "parslet", "default"), runtime.parseShapeWithCompatibility("ab?", "parslet"));
} finally { runtime.artifact.free(); }
const second = new compiled.PargRuntime(JSON.stringify(envelope));
try { assert.deepEqual(second.parseShape("a!"), shape); } finally { second.artifact.free(); }
console.log(`packed-node: ok on ${process.version}`);
