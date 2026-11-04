import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
await mkdir('test-results/worksheet',{recursive:true});
const outfile=resolve('test-results/worksheet/runner.mjs');
await build({entryPoints:['scripts/worksheet-benchmark.ts'],bundle:true,platform:'node',format:'esm',outfile});
await import(pathToFileURL(outfile).href);
