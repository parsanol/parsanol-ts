import { PargRuntime } from "./runtime.js";
export type TestKind = "accept" | "reject" | "example";
export interface SuiteTest {
    kind: TestKind;
    input: string;
    expect?: Record<string, string>;
}
export interface Suite {
    name: string;
    entry?: string;
    tests: SuiteTest[];
}
/** Parse one *.pgtest file (same grammar as Parsanol::PG::Suite#read_file). */
export declare function readSuite(text: string, name: string): Suite;
/** Load every *.pgtest file in a directory. */
export declare function loadSuites(dir: string): Suite[];
/** Run a suite against a runtime; returns failure descriptions. */
export declare function runSuite(runtime: PargRuntime, suite: Suite): string[];
/** The default suites directory: PARG_SUITES_DIR when set. */
export declare function suitesDir(): string | null;
