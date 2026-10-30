import {build} from 'esbuild';
import {copyFile,readFile,writeFile} from 'node:fs/promises';
await build({entryPoints:{service:'src/agent/service.ts',worker:'src/agent/jobs.ts',bridge:'src/agent/bridge.ts'},outdir:'engine',outExtension:{'.js':'.cjs'},bundle:true,platform:'node',format:'cjs',target:'node22',sourcemap:true,external:['electron']});
await build({entryPoints:['src/agent/mcp.ts'],outfile:'mcp/server.mjs',bundle:true,platform:'node',format:'esm',target:'node22',sourcemap:true,banner:{js:"import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"}});
await copyFile('LICENSE','mcp/LICENSE');
const notices=await Promise.all(['@modelcontextprotocol-server','@modelcontextprotocol-core','zod'].map(async name=>name+'\n'+await readFile('docs/licenses/'+name+'-LICENSE.txt','utf8')));
await writeFile('mcp/THIRD-PARTY-NOTICES.txt',notices.join('\n\n--------------------\n\n'));
console.log('Built shared design engine, analysis worker and licensed MCP companion.');
