import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
await mkdir('test-results/anatomy',{recursive:true});
const outfile=resolve('test-results/anatomy/run.mjs');
await build({entryPoints:['scripts/anatomy-benchmark.ts'],bundle:true,platform:'node',format:'esm',outfile});
await import(pathToFileURL(outfile).href);
