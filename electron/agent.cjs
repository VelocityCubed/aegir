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
  const service=await new DesignService({directory,workerPath:path.join(__dirname,'..','engine','worker.cjs'),cadStatus:async()=>Boolean(await pythonPath()),exportStep,capture:async(region,revision)=>{
    if(win.isMinimized())win.restore();if(!win.isVisible())win.showInactive();
    for(let i=0;i<500;i++){const painted=await win.webContents.executeJavaScript("(()=>{const el=document.querySelector('[data-workspace-revision]');return el?.getAttribute('data-analysis-status')!=='pending'?Number(el?.getAttribute('data-workspace-revision')??-1):-1})()");if(painted>=revision)break;if(i===499)throw Error('Desktop has not rendered the requested revision.');await new Promise(r=>setTimeout(r,20));}
    await win.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    let rect;
    if(region!=='window'){
      const selector=region==='model'?'.model-view':'.response-card';
      rect=await win.webContents.executeJavaScript(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect();return {x:Math.max(0,Math.round(r.x)),y:Math.max(0,Math.round(r.y)),width:Math.round(r.width),height:Math.round(r.height)}})()`);
      if(!rect)throw Error('Requested view is not visible. Select Design studio first.');
    }
    return (await win.webContents.capturePage(rect)).toPNG();
  }}).initialize();
  service.on('state',state=>{if(!win.isDestroyed())win.webContents.send('agent:state',state);});
  service.on('job',job=>{if(!win.isDestroyed())win.webContents.send('agent:job',job);});
  const trusted=e=>{if(e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted sender');};
  ipcMain.handle('agent:command',async(e,command)=>{trusted(e);try{return {result:await service.dispatch({...command,actor:'desktop'})};}catch(error){return {error:{code:error.code??'INVALID_COMMAND',message:error.message,details:error.details??error.issues}};}});
  ipcMain.handle('agent:connection',async e=>{trusted(e);return {connectionFile:path.join(directory,'connection.json'),filesDirectory:service.files,serverPath:app.isPackaged?path.join(process.resourcesPath,'mcp','server.mjs'):path.resolve(__dirname,'..','mcp','server.mjs')};});
  const bridge=await startBridge(service,path.join(directory,'connection.json'),{executable:app.getPath('exe'),args:app.isPackaged?[]:[path.resolve(__dirname,'..')]});
  return {service,exportStep,manifest:project=>{const g=buildGeometry(project);if(g.errors.length)throw Error(g.errors.join(' '));return {project,panels:g.panels};},close:async()=>{await bridge.close();await service.close();}};
};
