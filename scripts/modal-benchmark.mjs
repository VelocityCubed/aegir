import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
await mkdir("test-results", { recursive: true });
const outfile = resolve("test-results/modal-benchmark.mjs");
await build({
  entryPoints: ["scripts/modal-benchmark.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
});
await import(pathToFileURL(outfile).href);
