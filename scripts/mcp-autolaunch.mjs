import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {mkdtemp,readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const profile=await mkdtemp(join(tmpdir(),'aegir-launch-')),clients=[];
const serverPath=resolve(process.env.AEGIR_TEST_SERVER??'mcp/server.mjs');
let pid;
async function client(){const c=new Client({name:'aegir-lifecycle-test',version:'1.0.0'});clients.push(c);const env={...process.env,AEGIR_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.WAVELAB_DEV;await c.connect(new StdioClientTransport({command:process.execPath,args:[serverPath],env,stderr:'pipe'}));return c;}
async function call(c,name,args={}){const r=await c.callTool({name:'aegir_'+name,arguments:args});if(r.isError)throw Error(r.content[0].text);return r.structuredContent.result;}
try{
  const a=await client(),status=await call(a,'status_get');assert.equal(status.liveDesktop,true);
  const connection=JSON.parse(await readFile(join(profile,'agent/connection.json'),'utf8'));pid=connection.pid;assert.ok(pid>0);process.kill(pid,0);
  if(process.platform==='win32'){
    let visible=false;for(let i=0;i<50;i++){const handle=execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${Number(pid)}).MainWindowHandle`],{encoding:'utf8',windowsHide:true}).trim();if(Number(handle)>0){visible=true;break;}await new Promise(r=>setTimeout(r,100));}assert.ok(visible,'Cold-launched desktop must have a visible window without a second launch or capture.');
  }
  const b=await client(),before=await call(b,'workspace_get');
  await call(a,'project_patch',{name:'Shared multi-client workspace',expectedProjectRevision:before.projectRevision});
  assert.equal((await call(b,'workspace_get')).project.name,'Shared multi-client workspace');
  const stale=await b.callTool({name:'aegir_project_patch',arguments:{name:'Stale overwrite',expectedProjectRevision:before.projectRevision}});assert.equal(stale.isError,true);assert.equal(JSON.parse(stale.content[0].text).code,'REVISION_CONFLICT');
  await call(b,'view_set',{metric:'velocity'});
  const latest=await call(a,'workspace_get');assert.equal(latest.view.metric,'velocity');
  await Promise.all(clients.map(c=>c.close()));process.kill(pid);pid=undefined;
  await new Promise(r=>setTimeout(r,1000));
  const restarted=await client(),restored=await call(restarted,'workspace_get');assert.equal(restored.project.name,latest.project.name);assert.equal(restored.view.metric,'velocity');
  pid=JSON.parse(await readFile(join(profile,'agent/connection.json'),'utf8')).pid;
  const out=resolve(process.env.AEGIR_TEST_OUT??'test-results/mcp');await mkdir(out,{recursive:true});await writeFile(join(out,'lifecycle.json'),JSON.stringify({profile,serverPath,autoLaunch:true,sharedClients:true,projectRevisionConflict:true,restartAfterStaleDiscovery:true,restoredProject:restored.project.name},null,2));
  console.log('MCP lifecycle passed: visible cold auto-launch, two clients share the actual desktop, project-revision conflict, stale-discovery relaunch and durable recovery.');
}finally{await Promise.allSettled(clients.map(c=>c.close()));if(pid)try{process.kill(pid);}catch{}}
