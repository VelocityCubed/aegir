const {app,ipcMain}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const {DesignService,buildGeometry}=require('../engine/service.cjs');
const {startBridge}=require('../engine/bridge.cjs');

exports.startAgent=async function(win,{pythonPath,cadRoot}){
  const directory=path.join(app.getPath('userData'),'agent');
  const exportStep=async(manifest,destination)=>{
    const python=await pythonPath();if(!python)throw Error('CadQuery runtime unavailable. Run npm run setup:cad.');
    const temp=await fs.mkdtemp(path.join(app.getPath('temp'),'aegir-cad-'));
    try{const input=path.join(temp,'geometry.json');await fs.writeFile(input,JSON.stringify(manifest),'utf8');await run(python,[path.join(cadRoot(),'export_step.py'),input,destination],{windowsHide:true,timeout:120000,maxBuffer:1000000});}
    finally{await fs.rm(temp,{recursive:true,force:true});}
  };
  let fieldReady=false,fieldCapabilities={webgpu:false,ready:false};const fieldPending=new Map();
  const runField=async(id,project,settings,onProgress,signal)=>{
    for(let i=0;!fieldReady&&i<150;i++){if(signal.aborted)throw Error('Field study cancelled.');await new Promise(r=>setTimeout(r,100));}
    if(!fieldReady)throw Error('Desktop field executor is not ready.');
    return new Promise((resolve,reject)=>{
      const abort=()=>{if(!win.isDestroyed())win.webContents.send('field:cancel',id);finish(Error('Field study cancelled.'));};
      const timer=setTimeout(()=>{if(!win.isDestroyed())win.webContents.send('field:cancel',id);finish(Error('Spatial study exceeded two minutes. Use a coarser grid or shorter duration.'));},120000);
      const finish=(error,result)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);fieldPending.delete(id);error?reject(error):resolve(result);};
      fieldPending.set(id,{finish,onProgress});signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}win.webContents.send('field:run',{id,project,settings});
    });
  };
  const service=await new DesignService({directory,workerPath:path.join(__dirname,'..','engine','worker.cjs'),runField,fieldCapabilities:()=>fieldCapabilities,cadStatus:async()=>Boolean(await pythonPath()),exportStep,capture:async(region,revision)=>{
    if(win.isMinimized())win.restore();if(!win.isVisible())win.showInactive();
    for(let i=0;i<500;i++){const painted=await win.webContents.executeJavaScript("(()=>{const el=document.querySelector('[data-workspace-revision]');return el?.getAttribute('data-analysis-status')!=='pending'"+(region==='field'?"&&document.querySelector('.field-workbench')?.getAttribute('data-field-state')==='ready'":'')+"?Number(el?.getAttribute('data-workspace-revision')??-1):-1})()");if(painted>=revision)break;if(i===499)throw Error('Desktop has not rendered the requested revision.');await new Promise(r=>setTimeout(r,20));}
    await win.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    let rect;
    if(region!=='window'){
      const selector=region==='field'?'.field-workbench':region==='model'?'.model-view':'.response-card';
      rect=await win.webContents.executeJavaScript(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect(),x=Math.max(0,Math.round(r.left)),y=Math.max(0,Math.round(r.top)),width=Math.min(innerWidth,Math.round(r.right))-x,height=Math.min(innerHeight,Math.round(r.bottom))-y;return width>0&&height>0?{x,y,width,height}:null})()`);
      if(!rect)throw Error('Requested view is not visible. Select the relevant desktop tab first.');
    }
    return (await win.webContents.capturePage(rect)).toPNG();
  }}).initialize();
  service.on('state',state=>{if(!win.isDestroyed())win.webContents.send('agent:state',state);});
  service.on('job',job=>{if(!win.isDestroyed())win.webContents.send('agent:job',job);});
  const trusted=e=>{if(e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted sender');};
  ipcMain.handle('field:ready',(e,caps)=>{trusted(e);fieldReady=true;fieldCapabilities={...caps,ready:true};});
  ipcMain.handle('field:progress',(e,{id,value})=>{trusted(e);if(Number.isFinite(value))fieldPending.get(id)?.onProgress(Math.max(0,Math.min(1,value)));});
  ipcMain.handle('field:complete',(e,{id,result,error})=>{trusted(e);const pending=fieldPending.get(id);if(!pending)return;if(error){pending.finish(Error(String(error)));return;}if(!(result?.data instanceof Float32Array)||result.data.byteLength>15*1024*1024||!(result.mask instanceof Uint8Array)){pending.finish(Error('Invalid spatial recording.'));return;}pending.finish(null,result);});
  win.webContents.on('did-start-navigation',()=>{fieldReady=false;for(const pending of fieldPending.values())pending.finish(Error('Desktop reloaded during spatial study.'));});
  ipcMain.handle('agent:command',async(e,command)=>{trusted(e);try{return {result:await service.dispatch({...command,actor:'desktop'})};}catch(error){return {error:{code:error.code??'INVALID_COMMAND',message:error.message,details:error.details??error.issues}};}});
  ipcMain.handle('agent:connection',async e=>{trusted(e);return {connectionFile:path.join(directory,'connection.json'),filesDirectory:service.files,serverPath:app.isPackaged?path.join(process.resourcesPath,'mcp','server.mjs'):path.resolve(__dirname,'..','mcp','server.mjs')};});
  const bridge=await startBridge(service,path.join(directory,'connection.json'),{executable:app.getPath('exe'),args:app.isPackaged?[]:[path.resolve(__dirname,'..')]});
  return {service,exportStep,manifest:project=>{const g=buildGeometry(project);if((g.physicalErrors??g.errors).length)throw Error((g.physicalErrors??g.errors).join(' '));return {project,panels:g.panels};},close:async()=>{await bridge.close();await service.close();}};
};
