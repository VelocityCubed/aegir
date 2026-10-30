const {app,BrowserWindow,ipcMain,dialog,shell,session} = require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const root=path.resolve(__dirname,'..');
// Keep existing Chromium storage (projects, drivers, comparisons) across the rename.
// Explicit --user-data-dir remains authoritative for isolated tests and profiles.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  const profile=path.join(app.getPath('appData'),'WaveLab TL Studio');
  require('node:fs').mkdirSync(profile,{recursive:true});
  app.setPath('userData',profile);
}
let win;
const workspaceLock=app.requestSingleInstanceLock();
if(!workspaceLock)app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
const cadRoot=()=>app.isPackaged?path.join(process.resourcesPath,'cad'):path.join(root,'cad');
function senderCheck(event){if(!win || event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame) throw Error('Untrusted sender');}
async function pythonPath(){
  const py=process.platform==='win32'?'Scripts/python.exe':'bin/python';
  const launchDir=process.env.PORTABLE_EXECUTABLE_DIR||path.dirname(app.getPath('exe'));
  const candidates=[process.env.AEGIR_PYTHON,process.env.WAVELAB_PYTHON,path.join(root,'.venv',py),path.join(launchDir,'cad-runtime',py),path.join(launchDir,'..','.venv',py),path.join(launchDir,'..','..','.venv',py),path.join(app.getPath('userData'),'cad-runtime',py),'python'];
  for(const candidate of candidates.filter(Boolean)) {
    try {await run(candidate,['-c','import cadquery; print(cadquery.__version__)'],{windowsHide:true,timeout:20000,maxBuffer:4096});return candidate;}catch{}
  }
  return null;
}
app.whenReady().then(async()=>{
  if(!workspaceLock)return;
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));
  win=new BrowserWindow({width:1600,height:1050,minWidth:1120,minHeight:760,backgroundColor:'#0b0f13',title:'ÆONFORGE ÆGIR · Acoustic Engineering',icon:path.join(__dirname,'icon.png'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.once('ready-to-show',()=>win.show());
  const agent=await require('./agent.cjs').startAgent(win,{pythonPath,cadRoot});
  let stopping=false;
  app.on('before-quit',event=>{if(stopping)return;event.preventDefault();stopping=true;agent.close().catch(error=>console.error('Workspace shutdown:',error.message)).finally(()=>app.quit());});
  if(process.env.WAVELAB_DEV==='1') win.loadURL('http://127.0.0.1:5173');else win.loadFile(path.join(root,'dist','index.html'));
  ipcMain.handle('project:save',async(e,data)=>{senderCheck(e);if(typeof data!=='string'||data.length>1_000_000)throw Error('Project too large');const parsed=JSON.parse(data);if(parsed.version!==1)throw Error('Unsupported project');const result=await dialog.showSaveDialog(win,{defaultPath:'design.aegir.json',filters:[{name:'Aegir project (including legacy WaveLab JSON)',extensions:['json']}]});if(result.canceled)return null;await fs.writeFile(result.filePath,data,'utf8');return result.filePath;});
  ipcMain.handle('project:open',async(e)=>{senderCheck(e);const result=await dialog.showOpenDialog(win,{filters:[{name:'Aegir project (including legacy WaveLab JSON)',extensions:['json']}],properties:['openFile']});if(result.canceled)return null;const stat=await fs.stat(result.filePaths[0]);if(stat.size>1_000_000)throw Error('Project too large');return fs.readFile(result.filePaths[0],'utf8');});
  ipcMain.handle('file:export',async(e,{name,bytes})=>{senderCheck(e);if(typeof name!=='string'||!ArrayBuffer.isView(bytes)||bytes.byteLength>50_000_000)throw Error('Invalid export');const result=await dialog.showSaveDialog(win,{defaultPath:path.basename(name)});if(result.canceled)return null;await fs.writeFile(result.filePath,Buffer.from(bytes));return result.filePath;});
  ipcMain.handle('cad:status',async(e)=>{senderCheck(e);return {available:Boolean(await pythonPath())};});
  ipcMain.handle('cad:step',async(e,project)=>{
    senderCheck(e);const python=await pythonPath();if(!python)throw Error('CadQuery backend unavailable. Run npm run setup:cad, or set AEGIR_PYTHON to a Python executable with CadQuery installed.');
    if(typeof project!=='string'||project.length>1_000_000)throw Error('Invalid project');
    const result=await dialog.showSaveDialog(win,{defaultPath:'enclosure.step',filters:[{name:'STEP assembly',extensions:['step']}]});if(result.canceled)return null;
    const tmp=await fs.mkdtemp(path.join(app.getPath('temp'),'aegir-'));
    try {const input=path.join(tmp,'project.json');await fs.writeFile(input,JSON.stringify(agent.manifest(JSON.parse(project))),'utf8');await run(python,[path.join(cadRoot(),'export_step.py'),input,result.filePath],{windowsHide:true,timeout:120000,maxBuffer:1_000_000});return result.filePath;}
    finally {await fs.rm(tmp,{recursive:true,force:true});}
  });
  ipcMain.handle('help:research',async(e)=>{senderCheck(e);await shell.openPath(path.join(root,'docs','RESEARCH.md'));});
});
app.on('window-all-closed',()=>app.quit());
