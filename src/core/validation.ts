import type { Project } from './types';
import { driverModel } from './acoustics';
const bounds: Record<string, [number,number]> = {
  fs:[10,250],qes:[0.08,3],qms:[0.3,30],vas:[0.2,1000],re:[0.5,32],le:[0,10],sd:[10,2000],xmax:[0.5,40],cutout:[25,600],frame:[30,700],depth:[10,500],
  length:[0.5,6],areaRatio:[0.5,8],laneWidth:[50,700],folds:[1,4],thickness:[6,40],driverPosition:[0.01,0.8],damping:[0,5],voltage:[0.1,80],temperature:[0,40],
  low:[15,150],high:[60,500],maxHeight:[200,2500],maxWidth:[100,1800],maxDepth:[100,1200],minLength:[0.5,6],maxLength:[0.5,6],maxVelocity:[1,50]
};
export function validateProject(value: unknown): asserts value is Project {
  if(!value || typeof value !== 'object') throw Error('Project must be a JSON object.');
  const p = value as Project;
  if(p.version!==1 || typeof p.name!=='string' || p.name.length>150) throw Error('Unsupported project version or invalid name.');
  for(const [key, sample] of Object.entries({driver:['fs','qes','qms','vas','re','le','sd','xmax','cutout','frame','depth'],design:['length','areaRatio','laneWidth','folds','thickness','driverPosition','damping','voltage','temperature'],targets:['low','high','maxHeight','maxWidth','maxDepth','minLength','maxLength','maxVelocity']})) {
    const group = (p as unknown as Record<string, Record<string, unknown>>)[key];
    if(!group || typeof group!=='object') throw Error(`Missing ${key}.`);
    for(const name of sample) {
      const v=group[name], [lo,hi]=bounds[name];
      if(typeof v!=='number' || !Number.isFinite(v) || v<lo || v>hi) throw Error(`${name} must be between ${lo} and ${hi}.`);
    }
  }
  if(!Number.isInteger(p.design.folds)) throw Error('Pass count must be an integer.');
  if(p.targets.low>=p.targets.high) throw Error('Target low frequency must be below the high frequency.');
  if(p.targets.minLength>=p.targets.maxLength) throw Error('Minimum line length must be below maximum.');
  if(p.driver.frame<p.driver.cutout) throw Error('Driver frame must be larger than its cutout.');
  const model=driverModel(p);
  if(model.mmd<=0 || model.rmd<=0) throw Error('These T/S values imply non-positive suspension mass or resistance after free-air correction. Check Fs, Vas, Sd and Qms.');
  for(const k of ['id','name','note'] as const) if(typeof p.driver[k]!=='string' || p.driver[k].length>2000) throw Error(`Invalid driver ${k}.`);
  if(p.layout!==undefined) {
    const l=p.layout;
    if(!l||typeof l!=='object')throw Error('layout must be an object.');
    for(const k of ['width','height','depth'] as const)if(typeof l[k]!=='number'||!Number.isFinite(l[k])||l[k]<2*p.design.thickness+20||l[k]>4000)throw Error(`layout.${k} must leave a positive cavity and be below 4000 mm.`);
    const xy=(pt:unknown)=>Array.isArray(pt)&&pt.length===2&&pt.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=5000);
    if(!Array.isArray(l.baffles)||l.baffles.length>64)throw Error('Custom layout supports at most 64 internal baffles.');
    const ids=new Set<string>(['front','back','left','right','top','bottom','left-2','right-2','top-2','bottom-2']);
    for(const b of l.baffles){if(!b||typeof b.id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(b.id)||ids.has(b.id))throw Error('Baffle IDs must be unique safe identifiers, distinct from shell panels.');ids.add(b.id);if(typeof b.label!=='string'||b.label.length>150||!xy(b.start)||!xy(b.end)||Math.hypot(b.end[0]-b.start[0],b.end[1]-b.start[1])<1)throw Error(`Invalid baffle ${b.id}.`);if(b.thickness!==undefined&&(!Number.isFinite(b.thickness)||b.thickness<6||b.thickness>80))throw Error(`Invalid baffle thickness ${b.id}.`);}
    if(!Array.isArray(l.route)||l.route.length<2||l.route.length>512||!l.route.every(xy))throw Error('Wave route must contain 2–512 [x,y] points in millimetres.');
    if(l.route.slice(1).some((point,i)=>Math.hypot(point[0]-l.route[i][0],point[1]-l.route[i][1])<.01))throw Error('Consecutive route points must be at least 0.01 mm apart.');
    const routeMm=l.route.slice(1).reduce((sum,pt,i)=>sum+Math.hypot(pt[0]-l.route[i][0],pt[1]-l.route[i][1]),0);if(routeMm>24000)throw Error('Wave route exceeds the 24 m computation limit.');
    if(!l.mouth||!['top','bottom','left','right'].includes(l.mouth.side)||!Number.isFinite(l.mouth.offset)||!Number.isFinite(l.mouth.width)||l.mouth.width<5||l.mouth.width>4000)throw Error('Invalid physical mouth.');
  }
  if(p.mounts!==undefined){if(!Array.isArray(p.mounts)||p.mounts.length<1||p.mounts.length>8)throw Error('A design supports 1–8 driver mounts.');const ids=new Set<string>();for(const m of p.mounts){if(!m||typeof m.id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(m.id)||ids.has(m.id))throw Error('Driver mount IDs must be unique safe identifiers.');ids.add(m.id);if(!Number.isFinite(m.position)||m.position<=0||m.position>=1||!['front','back'].includes(m.face)||!Number.isFinite(m.voltageScale)||m.voltageScale<0||m.voltageScale>10||!Number.isFinite(m.phase)||Math.abs(m.phase)>360)throw Error(`Invalid mounting or excitation for ${m.id}.`);validateProject({...p,driver:m.driver,mounts:undefined,layout:undefined});}}
}
