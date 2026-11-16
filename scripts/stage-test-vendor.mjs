// The tests compile src/ into dist-test/src/, whose runtime imports the
// engine glue at ../vendor/parsanol-web/. Stage that glue next to it so the
// compiled tests resolve the same import as the published dist/.
import { cpSync } from "node:fs";
cpSync("vendor/parsanol-web", "dist-test/vendor/parsanol-web", { recursive: true });
