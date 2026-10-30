export {};
declare global {
  interface Window { desktop?: {
    command:(command:import('./agent/contracts').Command)=>Promise<any>;
    agentConnection:()=>Promise<{connectionFile:string;filesDirectory:string;serverPath:string}>;
    onState:(callback:(state:import('./agent/contracts').WorkspaceState)=>void)=>()=>void;
    onJob:(callback:(job:any)=>void)=>()=>void;
    saveProject:(data:string)=>Promise<string|null>;
    openProject:()=>Promise<string|null>;
    exportFile:(name:string,bytes:Uint8Array)=>Promise<string|null>;
    cadStatus:()=>Promise<{available:boolean}>;
    exportStep:(project:string)=>Promise<string|null>;
    research:()=>Promise<void>;
  } }
}
