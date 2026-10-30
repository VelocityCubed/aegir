export {};
declare global {
  interface Window { desktop?: {
    command:(command:import('./agent/contracts').Command)=>Promise<any>;
    agentConnection:()=>Promise<{connectionFile:string;filesDirectory:string;serverPath:string}>;
    onState:(callback:(state:import('./agent/contracts').WorkspaceState)=>void)=>()=>void;
    onJob:(callback:(job:any)=>void)=>()=>void;
    fieldReady:(caps:unknown)=>Promise<void>;
    onFieldRun:(callback:(request:{id:string;project:import('./core/types').Project;settings:import('./field/types').FieldSettings})=>void)=>()=>void;
    onFieldCancel:(callback:(id:string)=>void)=>()=>void;
    fieldProgress:(id:string,value:number)=>Promise<void>;
    fieldComplete:(id:string,result?:import('./field/types').FieldResult,error?:string)=>Promise<void>;
    saveProject:(data:string)=>Promise<string|null>;
    openProject:()=>Promise<string|null>;
    exportFile:(name:string,bytes:Uint8Array)=>Promise<string|null>;
    cadStatus:()=>Promise<{available:boolean}>;
    exportStep:(project:string)=>Promise<string|null>;
    research:()=>Promise<void>;
  } }
}
