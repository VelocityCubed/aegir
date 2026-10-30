import {McpServer,ResourceTemplate} from '@modelcontextprotocol/server';
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {z} from 'zod';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {commands,projectSchema,type CommandName} from './contracts';

const option=(name:string)=>{const full=process.argv.find(v=>v.startsWith('--'+name+'='));if(full)return full.slice(name.length+3);const at=process.argv.indexOf('--'+name);return at>=0?process.argv[at+1]:undefined;};
const profile=option('profile')??process.env.AEGIR_PROFILE??path.join(process.env.APPDATA??path.join(os.homedir(),'.config'),'WaveLab TL Studio');
const connectionFile=path.resolve(option('connection')??process.env.AEGIR_CONNECTION??path.join(profile,'agent','connection.json'));
let connection:any,launched=false;
async function readConnection(){
  const value=JSON.parse(await fs.readFile(connectionFile,'utf8')),url=new URL(value.url);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.username||url.password||url.hash||url.search||!/^\d+$/.test(url.port)||typeof value.token!=='string'||!/^[a-f0-9]{64}$/.test(value.token))throw Error('Invalid local ÆGIR connection record.');
  return value;
}
async function connect(){
  try{const current=await readConnection();const health=await fetch(current.url+'/health',{headers:{Authorization:'Bearer '+current.token},signal:AbortSignal.timeout(1500)});const body=await health.json();if(health.ok&&body.name==='aegir-desktop'){connection=current;return;}}catch{}
  if(!launched){
    launched=true;const explicit=option('app')??process.env.AEGIR_APP;
    let executable=explicit,args:string[]=[];
    if(!executable){
      const here=path.dirname(fileURLToPath(import.meta.url));
      // Source distribution uses Electron; packaged resources find the adjacent application.
      const root=path.resolve(here,'..');
      try{const manifest=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));if(manifest.main==='electron/main.cjs'){executable=path.join(root,'node_modules','electron','dist',process.platform==='win32'?'electron.exe':'electron');args=[root];}}catch{}
      if(!executable)executable=path.resolve(here,'..','..','AEONFORGE Aegir.exe');
    }
    if(option('profile')||process.env.AEGIR_PROFILE)args.push('--user-data-dir='+profile);
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const child=spawn(executable,args,{stdio:'ignore',detached:true,windowsHide:false,env});child.on('error',error=>process.stderr.write('ÆGIR launch: '+error.message+'\n'));child.unref();
  }
  for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,200));try{const current=await readConnection();const response=await fetch(current.url+'/health',{headers:{Authorization:'Bearer '+current.token},signal:AbortSignal.timeout(1000)});if(response.ok&&(await response.json()).name==='aegir-desktop'){connection=current;return;}}catch{}}
  throw Error('Cannot connect to a live ÆGIR desktop. Start the MCP-enabled build or set AEGIR_APP / --app, and use --connection for an isolated profile. Connection file: '+connectionFile);
}
async function call(name:CommandName,args:Record<string,unknown>={},expectedRevision?:number,expectedProjectRevision?:number){
  await connect();
  const response=await fetch(connection.url+'/command',{method:'POST',headers:{Authorization:'Bearer '+connection.token,'Content-Type':'application/json'},body:JSON.stringify({name,args,expectedRevision,expectedProjectRevision}),signal:AbortSignal.timeout(120000)});
  const body=await response.json();if(body.error){const error:any=Error(body.error.message);error.code=body.error.code;error.details=body.error.details;throw error;}return body.result;
}
const workflow=`You control the live ÆONFORGE ÆGIR desktop, not a separate calculator.
1. Read aegir_workspace_get, aegir_status_get and aegir://schema. Reuse existing work unless a new project is requested.
2. Translate the user's brief into explicit driver data, target band, stock thickness, outer dimensions, baffle endpoints, physical mouth and intended route. Units: geometry mm, driver Sd cm², Vas L, Le mH, route-position fractions and V RMS excitation. Never invent manufacturer specifications; examples are synthetic.
3. Use generated project parameters or layout.convert/layout.set for custom baffles. Custom XY coordinates begin at the inner bottom-left; y points upward. route points run from a closed wall to the mouth centre. Moving a board does not silently move the route. Use route.trace when appropriate and inspect the resulting sampled sections.
4. Read every returned geometry error. Correct collisions, source fit, mouth placement and blocked paths before simulation/export. The fast solver is segmented 1D. For spatial reflections/interference, use field.run, poll job.get, then field.result and field.open. The experimental 3D field uses actual solids/exterior air and two-way T/S piston coupling; inspect grid/PML/volume quality and warnings. Do not use it as validated stuffing/structural/nonlinear prediction.
5. Use expectedRevision for edits when competing with a user/another agent. Preserve a snapshot before alternatives; history.undo/redo recover mistakes. Read again after REVISION_CONFLICT rather than overwriting newer work.
6. Analysis and optimisation return job IDs. Poll job.get with includeResult, handle failure/cancellation, and apply a candidate explicitly. Results become stale if the project changes. Sweeps use existing numeric paths; custom search requires bounded numeric parameters.
7. Set view/camera/section/graph/probe and capture actual rendered PNGs. In Wave propagation use view.set field.frame/metric/range/playing to control recorded physical time and quantities; region field captures the actual field workbench. field.result can return a bounded frame or pressure/driver traces, and its artifact is the complete study ZIP. Verify the user can see the design and that baffles, driver openings and wave travel match the brief.
8. Export the engineering report, project and fabrication bundle, plus STEP if CAD is available. Angled board end mitres are encoded in the 3D solids; flat stock DXF is not a bevel toolpath. Report source-data assumptions, geometry/model limitations, artifact paths and prototype checks honestly.`;

export function createServer(){
  const server=new McpServer({name:'aeonforge-aegir',version:'0.4.1'},{instructions:workflow});
  for(const [name,definition] of Object.entries(commands)){
    if(name==='workspace.bootstrap')continue;
    const schema=definition.schema.extend({expectedRevision:z.number().int().nonnegative().optional().describe('Optimistic workspace revision; stale edits fail instead of overwriting changes.'),expectedProjectRevision:z.number().int().nonnegative().optional().describe('Guard the project revision only, allowing unrelated viewport changes.')});
    server.registerTool('aegir_'+name.replaceAll('.','_'),{description:definition.description,inputSchema:schema,annotations:{readOnlyHint:'read' in definition&&Boolean(definition.read),destructiveHint:/remove|replace|project.new|project.open|snapshot.restore/.test(name),idempotentHint:'read' in definition&&Boolean(definition.read),openWorldHint:false}},async(input:any)=>{
      const {expectedRevision,expectedProjectRevision,...args}=input;
      try{
        // Stdio clients commonly bound messages to 10 MiB. Base64 plus the
        // text/structured representations must stay below that bound.
        if(name==='artifact.read'&&args.offset===undefined&&args.length===undefined){const artifact=(await call('artifact.list')).find((a:any)=>a.id===args.id);if(artifact?.size>2*1024*1024){args.offset=0;args.length=1048576;}}
        let value=await call(name as CommandName,args,expectedRevision,expectedProjectRevision);
        if(name==='view.capture'){const artifact=await call('artifact.read',{id:value.id});return {content:[{type:'image' as const,data:artifact.data,mimeType:'image/png' as const},{type:'text' as const,text:JSON.stringify(value)}]};}
        return {content:[{type:'text' as const,text:JSON.stringify(value)}],structuredContent:{result:value}};
      }catch(error:any){return {isError:true,content:[{type:'text' as const,text:JSON.stringify({code:error.code??'CONNECTION_ERROR',message:error.message,details:error.details})}]};}
    });
  }
  for(const [name,uri,description,reader] of [
    ['workspace','aegir://workspace','Live canonical desktop workspace',()=>call('workspace.get')],
    ['schema','aegir://schema','Complete version-1 project schema including custom layouts and multi-driver mounts',()=>Promise.resolve(z.toJSONSchema(projectSchema))],
    ['capabilities','aegir://capabilities','Tool names, input units, model scope and desktop availability',()=>call('status.get')],
    ['workflow','aegir://workflow','Recommended agent workflow and modelling assumptions',()=>Promise.resolve(workflow)],
  ] as const)server.registerResource(name,uri,{description,mimeType:'application/json'},async url=>({contents:[{uri:url.href,mimeType:'application/json',text:JSON.stringify(await reader())}]}));
  server.registerResource('artifact',new ResourceTemplate('aegir://artifacts/{id}',{list:async()=>({resources:(await call('artifact.list')).map((a:any)=>({uri:'aegir://artifacts/'+a.id,name:a.name,mimeType:a.mimeType}))})}),{description:'Created project, CAD, report, numerical or screenshot artifact by stable ID; above 2 MiB use artifact_read byte chunks.'},async(uri,{id})=>{const info=(await call('artifact.list')).find((a:any)=>a.id===id);if(info?.size>2*1024*1024)throw Error('Large artifact: use aegir_artifact_read with offset/length and follow nextOffset until complete.');const artifact=await call('artifact.read',{id});return {contents:[artifact.encoding==='base64'?{uri:uri.href,mimeType:artifact.mimeType,blob:artifact.data}:{uri:uri.href,mimeType:artifact.mimeType,text:artifact.data}]};});
  server.registerPrompt('design-speaker',{description:'Plan and execute a complete live ÆGIR design from a user brief.',argsSchema:z.object({brief:z.string().max(16000)})},({brief})=>({messages:[{role:'user' as const,content:{type:'text' as const,text:workflow+'\n\nUser design brief:\n'+brief}}]}));
  return server;
}
if(!process.env.AEGIR_MCP_NO_START)serveStdio(()=>createServer(),{onerror:error=>process.stderr.write(error.message+'\n')});
