import type { Candidate, Project } from './types';
import { buildGeometry } from './geometry';
import { simulate } from './acoustics';
export function scoreProject(p:Project):Candidate|null {
  const g=buildGeometry(p),t=p.targets;
  if(g.errors.length || g.height>t.maxHeight || g.width>t.maxWidth || g.depth>t.maxDepth || g.lineLength<t.minLength || g.lineLength>t.maxLength) return null;
  const s=simulate(p,150),band=s.points.filter(v=>v.frequency>=t.low && v.frequency<=t.high);
  const rms=Math.sqrt(band.reduce((sum,v)=>sum+(v.spl-s.bandMean)**2,0)/band.length);
  const edge=band.slice(0,Math.max(2,Math.floor(band.length/8)));
  const lowMean=edge.reduce((sum,v)=>sum+v.spl,0)/edge.length;
  const ex=Math.max(...band.flatMap(v=>v.drivers?.map(d=>d.excursion/(g.mounts.find(m=>m.id===d.id)?.driver.xmax??p.driver.xmax))??[v.excursion/p.driver.xmax]));
  const speed=Math.max(...band.map(v=>v.velocity))/t.maxVelocity;
  // Explicit trade-offs, no universal claim of optimality. Lower score is better.
  const score=2*rms+0.35*s.ripple+2*Math.max(0,s.bandMean-lowMean-3)+12*Math.max(0,ex-1)+8*Math.max(0,speed-1)+0.012*g.airVolume-0.025*s.bandMean;
  return {project:p,score,simulation:s,geometry:g};
}
export async function optimize(project:Project,onProgress:(progress:number,valid:number)=>void,aborted:()=>boolean=()=>false):Promise<Candidate[]> {
  let seed=72819;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  const results:Candidate[]=[], seen=new Set<string>();
  const consider=(p:Project)=>{
    const key=[p.design.length,p.design.areaRatio,p.design.driverPosition,p.design.folds,p.design.laneWidth].map(n=>n.toFixed(3)).join('/');
    if(seen.has(key)) return; seen.add(key);
    const candidate=scoreProject(p); if(candidate) results.push(candidate);
  };
  consider(project);
  const total=1000,t=project.targets;
  for(let i=0;i<total;i++) {
    if(aborted()) break;
    const refine=i>650 && results.length>0;
    const base=refine?[...results].sort((a,b)=>a.score-b.score)[Math.floor(random()*Math.min(8,results.length))].project:project;
    const n=refine?base.design.folds:1+Math.floor(random()*4);
    const length=refine?base.design.length+(random()-.5)*.32:t.minLength+random()*(t.maxLength-t.minLength);
    const areaRatio=refine?base.design.areaRatio+(random()-.5)*.5:1.1+random()*3.4;
    const laneWidth=refine?base.design.laneWidth+(random()-.5)*20:project.driver.cutout+16+random()*65;
    const driverPosition=refine?base.design.driverPosition+(random()-.5)*.04:.055+random()*(Math.min(.36,.70/n)-.055);
    consider({...project,design:{...project.design,folds:n,length:Math.max(t.minLength,Math.min(t.maxLength,length)),areaRatio:Math.max(.5,Math.min(8,areaRatio)),laneWidth:Math.max(50,Math.min(700,laneWidth)),driverPosition:Math.max(.01,Math.min(.8,driverPosition))}});
    if(i%25===0) {onProgress(i/total,results.length);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  onProgress(1,results.length);
  return results.sort((a,b)=>a.score-b.score).filter((v,i,a)=>a.findIndex(w=>Math.abs(w.project.design.length-v.project.design.length)<.07 && w.project.design.folds===v.project.design.folds && Math.abs(w.project.design.areaRatio-v.project.design.areaRatio)<.15)===i).slice(0,6);
}
