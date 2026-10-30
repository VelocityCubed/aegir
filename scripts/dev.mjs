import {spawn} from 'node:child_process';
import electron from 'electron';
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'inherit',windowsHide:true});
let desktop;
for(let i=0;i<100;i++){
  try {const r=await fetch('http://127.0.0.1:5173');if(r.ok)break;}catch{}
  await new Promise(r=>setTimeout(r,100));
}
desktop=spawn(electron,['.'],{stdio:'inherit',windowsHide:true,env:{...process.env,WAVELAB_DEV:'1',ELECTRON_RUN_AS_NODE:''}});
const close=()=>{desktop?.kill();vite.kill();};
desktop.on('exit',()=>{vite.kill();process.exit();});process.on('SIGINT',close);process.on('SIGTERM',close);
