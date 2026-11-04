import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
await mkdir('test-results/convergence',{recursive:true});
const outfile=resolve('test-results/convergence/runner.mjs');
await build({entryPoints:['scripts/geometry-convergence.ts'],bundle:true,platform:'node',format:'esm',outfile});
await import(pathToFileURL(outfile).href);
