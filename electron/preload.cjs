const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
  command:async(command)=>{const response=await ipcRenderer.invoke('agent:command',command);if(response.error){const error=new Error(response.error.message);error.code=response.error.code;throw error;}return response.result;},
  agentConnection:()=>ipcRenderer.invoke('agent:connection'),
  onState:(callback)=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('agent:state',listener);return()=>ipcRenderer.removeListener('agent:state',listener);},
  onJob:(callback)=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('agent:job',listener);return()=>ipcRenderer.removeListener('agent:job',listener);},
  saveProject:(data)=>ipcRenderer.invoke('project:save',data),
  openProject:()=>ipcRenderer.invoke('project:open'),
  exportFile:(name,bytes)=>ipcRenderer.invoke('file:export',{name,bytes}),
  cadStatus:()=>ipcRenderer.invoke('cad:status'),
  exportStep:(project)=>ipcRenderer.invoke('cad:step',project),
  research:()=>ipcRenderer.invoke('help:research')
});
