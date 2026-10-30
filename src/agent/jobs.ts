import {parentPort,workerData} from 'node:worker_threads';
import {simulate,standingWave} from '../core/acoustics';
import {buildGeometry} from '../core/geometry';
import {scoreProject,optimize} from '../core/optimizer';
import {validateProject} from '../core/validation';
import {traceRoute} from '../core/layout';
import type {Project,Candidate} from '../core/types';
export function numericPath(p:Project,path:string,value?:number):number {
  const parts=path.split('.');if(parts.some(v=>!/^([a-zA-Z][a-zA-Z0-9]*|\d+)$/.test(v)||['__proto__','prototype','constructor'].includes(v)))throw Error('Unsafe parameter path.');
  let at:any=p;for(const part of parts.slice(0,-1)){if(!at||typeof at!=='object'||!Object.hasOwn(at,part))throw Error('Parameter path does not exist: '+path);at=at[part];}
  const last=parts.at(-1)!;if(!at||!Object.hasOwn(at,last)||typeof at[last]!=='number')throw Error('Parameter must address an existing numeric project field: '+path);
  if(value!==undefined){if(!Number.isFinite(value))throw Error('Parameter value must be finite.');at[last]=value;if(parts[0]==='driver'&&p.mounts?.length){const primary=p.mounts.find(m=>m.id==='primary')??p.mounts[0];primary.driver=structuredClone(p.driver);}if(parts[0]==='design'&&parts[1]==='driverPosition'&&p.mounts?.length)(p.mounts.find(m=>m.id==='primary')??p.mounts[0]).position=value;}return at[last];
}
export async function runJob(kind:string,project:Project,args:any,progress:(progress:number,valid?:number)=>void) {
  if(kind==='simulation'){progress(.05);return simulate(project,args.samples??240);}
  if(kind==='sweep'){
    const results=[];for(let i=0;i<args.values.length;i++){const p=structuredClone(project);try{numericPath(p,args.path,args.values[i]);validateProject(p);const g=buildGeometry(p);if(g.errors.length)throw Error(g.errors.join(' '));const s=simulate(p,args.samples??100);results.push({value:args.values[i],project:p,bandMean:s.bandMean,ripple:s.ripple,f3:s.f3,peakExcursion:s.peakExcursion,peakVelocity:s.peakVelocity,errors:[]});}catch(error){results.push({value:args.values[i],errors:[String((error as Error).message)]});}progress((i+1)/args.values.length);await new Promise(r=>setTimeout(r,0));}return results;
  }
  if(kind==='compare'){
    const result=[];for(let i=0;i<args.projects.length;i++){const item=args.projects[i],p={...item.project,targets:project.targets,design:{...item.project.design,voltage:project.design.voltage}};try{const s=simulate(p,args.samples??120);result.push({id:item.id,name:item.name,simulation:s,geometry:buildGeometry(p)});}catch(error){result.push({id:item.id,name:item.name,error:(error as Error).message});}progress((i+1)/args.projects.length);}return result;
  }
  if(kind==='optimisation'){
    if(!args.parameters?.length){if(project.layout)throw Error('Custom-layout optimisation requires explicit parameter ranges.');return optimize(project,(p,v)=>progress(p,v));}
    const parameters=args.parameters as {path:string;min:number;max:number}[];
    parameters.forEach(v=>{numericPath(project,v.path);if(v.min>=v.max)throw Error('Parameter min must be less than max: '+v.path);});
    let seed=72819;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
    const candidates:Candidate[]=[],initial=scoreProject(project);if(initial)candidates.push(initial);
    const count=args.iterations??250;
    for(let i=0;i<count;i++){
      const p=structuredClone(i>count*.65&&candidates.length?candidates[Math.floor(random()*Math.min(6,candidates.length))].project:project);
      for(const range of parameters){let value=i>count*.65&&candidates.length?numericPath(p,range.path)+(random()-.5)*(range.max-range.min)*.15:range.min+random()*(range.max-range.min);value=Math.max(range.min,Math.min(range.max,value));if(range.path==='design.folds')value=Math.round(value);numericPath(p,range.path,value);}
      try{if(args.retrace&&p.layout)p.layout.route=traceRoute(p,p.layout.route[0]);validateProject(p);const candidate=scoreProject(p);if(candidate){candidates.push(candidate);candidates.sort((a,b)=>a.score-b.score);if(candidates.length>30)candidates.length=30;}}catch{}
      if(i%5===0){progress(i/count,candidates.length);await new Promise(r=>setTimeout(r,0));}
    }
    const seen=new Set<string>();return candidates.filter(v=>{const key=parameters.map(p=>numericPath(v.project,p.path).toFixed(3)).join('/');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,6);
  }
  if(kind==='pressure')return standingWave(project,args.frequency,args.samples??100);
  throw Error('Unknown job type: '+kind);
}
if(parentPort)runJob(workerData.kind,workerData.project,workerData.args,(progress,valid)=>parentPort!.postMessage({type:'progress',progress,valid})).then(result=>parentPort!.postMessage({type:'done',result})).catch(error=>parentPort!.postMessage({type:'error',error:(error as Error).message}));
