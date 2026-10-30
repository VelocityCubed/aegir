import type {Project,Simulation} from './types';

/** Compare each source with its own one-way peak Xmax, within the target band. */
export function sourceHeadroom(p:Project,s:Simulation){
  const band=s.points.filter(v=>v.frequency>=p.targets.low&&v.frequency<=p.targets.high);
  const mounts=p.mounts?.length?p.mounts:[{id:'primary',driver:p.driver}];
  return mounts.map(m=>{const peakExcursion=Math.max(0,...band.map(v=>v.drivers?.find(d=>d.id===m.id)?.excursion??(mounts.length===1?v.excursion:0)));return {id:m.id,name:m.driver.name,xmax:m.driver.xmax,peakExcursion,ratio:peakExcursion/m.driver.xmax};});
}
