import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {readFile,writeFile} from 'node:fs/promises';
const configuration=JSON.parse((await readFile('test-results/codex-aegir.json','utf8')).replace(/^\uFEFF/,''));
if(!configuration.enabled||configuration.transport.type!=='stdio')throw Error('Codex aegir server is not enabled as stdio.');
const client=new Client({name:'aegir-installed-config-check',version:'1.0.0'});
try{
  await client.connect(new StdioClientTransport({...configuration.transport,env:configuration.transport.env??undefined,stderr:'pipe'}));
  const call=async name=>{const value=await client.callTool({name:'aegir_'+name,arguments:{}});if(value.isError)throw Error(value.content[0].text);return value.structuredContent.result;};
  const status=await call('status_get'),tools=await client.listTools();
  if(!status.liveDesktop||tools.tools.length!==48)throw Error('Installed connection does not expose the expected live desktop.');
  let state;for(let i=0;i<100;i++){state=await call('workspace_get');if(state.initialized)break;await new Promise(r=>setTimeout(r,100));}
  if(!state.initialized)throw Error('Desktop has not imported its persisted project.');
  const evidence={configuration,toolCount:tools.tools.length,status,initialized:state.initialized,projectRevision:state.projectRevision,storedDrivers:state.library.length,studies:state.snapshots.length};
  await writeFile('test-results/installed-mcp.json',JSON.stringify(evidence,null,2));
  console.log('Installed Codex configuration passed: 48 tools, real desktop auto-launch, initialized normal profile, '+state.library.length+' stored drivers and '+state.snapshots.length+' saved studies. App remains open.');
}finally{await client.close();}
