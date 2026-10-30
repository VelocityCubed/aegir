import {useCallback,useEffect,useRef,useState} from 'react';
import {defaultView,type Command,type ViewState,type WorkspaceState} from './contracts';
import type {Driver,Project,Snapshot} from '../core/types';
export function useWorkspace(initial:{project:Project;library:Driver[];snapshots:Snapshot[]},notify:(message:string)=>void){
  const [state,setState]=useState<WorkspaceState>(()=>({version:1,revision:0,projectRevision:0,...initial,view:structuredClone(defaultView),updatedAt:new Date().toISOString(),initialized:false}));
  const current=useRef(state);const accept=useCallback((value:WorkspaceState)=>{if(value.revision>=current.current.revision){const previous=current.current;const next={...value};for(const key of ['project','library','snapshots','view'] as const)if(JSON.stringify(value[key])===JSON.stringify(previous[key]))(next as any)[key]=previous[key];current.current=next;setState(next);}},[]);
  const [ready,setReady]=useState(!window.desktop),[jobs,setJobs]=useState<any[]>([]),[connection,setConnection]=useState<{connectionFile:string;serverPath:string;filesDirectory:string}|null>(null);
  useEffect(()=>{
    if(!window.desktop)return;
    const off=window.desktop.onState(accept),offJob=window.desktop.onJob(job=>setJobs(previous=>[job,...previous.filter(v=>v.id!==job.id)].slice(0,24)));
    window.desktop.command({name:'workspace.bootstrap',args:initial}).then(value=>{accept(value);setReady(true);}).catch(error=>notify(error.message));
    window.desktop.agentConnection().then(setConnection).catch(error=>notify(error.message));
    window.desktop.command({name:'job.list'}).then(setJobs).catch(()=>{});
    return()=>{off();offJob();};
  },[accept]);
  const command=useCallback(async(command:Command)=>{
    if(!window.desktop)throw Error('Live agent control requires the Electron desktop.');
    try{const value=await window.desktop.command(command);if(value?.version===1&&value.project&&value.view)accept(value);return value;}
    catch(error){notify((error as Error).message);const fresh=await window.desktop.command({name:'workspace.get'});accept(fresh);throw error;}
  },[accept,notify]);
  const replaceProject=(project:Project)=>{
    if(!window.desktop){accept({...current.current,project,revision:current.current.revision+1,projectRevision:current.current.projectRevision+1});return;}
    void command({name:'project.replace',args:{project},expectedProjectRevision:current.current.projectRevision}).catch(()=>{});
  };
  const library=(drivers:Driver[])=>{if(!window.desktop){accept({...current.current,library:drivers,revision:current.current.revision+1});return;}void command({name:'library.replace',args:{drivers}}).catch(()=>{});};
  const snapshots=(snapshots:Snapshot[])=>{if(!window.desktop){accept({...current.current,snapshots,revision:current.current.revision+1});return;}void command({name:'snapshot.replace',args:{snapshots}}).catch(()=>{});};
  const view=(patch:Partial<ViewState>)=>{if(!window.desktop){accept({...current.current,view:{...current.current.view,...patch},revision:current.current.revision+1});return;}void command({name:'view.set',args:patch}).catch(()=>{});};
  return {state,ready,jobs,connection,command,setProject:replaceProject,setLibrary:library,setSnapshots:snapshots,setView:view};
}
