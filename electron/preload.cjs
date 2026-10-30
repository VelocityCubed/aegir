const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
  command:async(command)=>{const response=await ipcRenderer.invoke('agent:command',command);if(response.error){const error=new Error(response.error.message);error.code=response.error.code;throw error;}return response.result;},
  agentConnection:()=>ipcRenderer.invoke('agent:connection'),
  onState:(callback)=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('agent:state',listener);return()=>ipcRenderer.removeListener('agent:state',listener);},
  onJob:(callback)=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('agent:job',listener);return()=>ipcRenderer.removeListener('agent:job',listener);},
  fieldReady:(caps)=>ipcRenderer.invoke('field:ready',caps),
  onFieldRun:(callback)=>{const listener=(_e,value)=>callback(value);ipcRenderer.on('field:run',listener);return()=>ipcRenderer.removeListener('field:run',listener);},
  onFieldCancel:(callback)=>{const listener=(_e,value)=>callback(value);ipcRenderer.on('field:cancel',listener);return()=>ipcRenderer.removeListener('field:cancel',listener);},
  fieldProgress:(id,value)=>ipcRenderer.invoke('field:progress',{id,value}),
  fieldComplete:(id,result,error)=>ipcRenderer.invoke('field:complete',{id,result,error}),
  saveProject:(data)=>ipcRenderer.invoke('project:save',data),
  openProject:()=>ipcRenderer.invoke('project:open'),
  exportFile:(name,bytes)=>ipcRenderer.invoke('file:export',{name,bytes}),
  cadStatus:()=>ipcRenderer.invoke('cad:status'),
  exportStep:(project)=>ipcRenderer.invoke('cad:step',project),
  research:()=>ipcRenderer.invoke('help:research')
});
