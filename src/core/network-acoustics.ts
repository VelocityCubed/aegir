import { abs,add,sub,mul,div,scale,type C } from './complex';
import { driverModel,lineMatrix,radiation } from './acoustics';
import { buildGeometry } from './geometry';
import type { Geometry,Point,Project,Section,Simulation } from './types';
type Matrix={a:C;b:C;c:C;d:C};
const identity=():Matrix=>({a:[1,0],b:[0,0],c:[0,0],d:[1,0]});
function compose(x:Matrix,y:Matrix):Matrix{return {a:add(mul(x.a,y.a),mul(x.b,y.c)),b:add(mul(x.a,y.b),mul(x.b,y.d)),c:add(mul(x.c,y.a),mul(x.d,y.c)),d:add(mul(x.c,y.b),mul(x.d,y.d))};}
function interpolate(sections:Section[],s:number):Section {
  let lo=0,hi=sections.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(sections[mid].distance<s)lo=mid+1;else hi=mid;}const i=Math.max(1,lo);
  const a=sections[i-1],b=sections[i]??sections.at(-1)!;const t=Math.max(0,Math.min(1,(s-a.distance)/(b.distance-a.distance||1)));
  return {distance:s,area:a.area+(b.area-a.area)*t,width:a.width+(b.width-a.width)*t,damping:a.damping+(b.damping-a.damping)*t};
}
export function profileMatrix(p:Project,g:Geometry,f:number,start:number,end:number):Matrix {
  const {c,rho}=driverModel(p);let result=identity();
  const cuts=[start,...g.sections.filter(s=>s.distance>start+1e-10&&s.distance<end-1e-10).map(s=>s.distance),end];
  for(let i=1;i<cuts.length;i++){const s=interpolate(g.sections,(cuts[i-1]+cuts[i])/2);result=compose(result,lineMatrix(f,cuts[i]-cuts[i-1],s.area*1e-6,c,rho,s.damping));}
  return result;
}
function solve(matrix:C[][],rhs:C[]):C[] {
  const n=rhs.length,a=matrix.map((row,i)=>[...row.map(v=>[...v] as C),[...rhs[i]] as C]);
  for(let i=0;i<n;i++) {
    let pivot=i;for(let j=i+1;j<n;j++)if(abs(a[j][i])>abs(a[pivot][i]))pivot=j;
    if(abs(a[pivot][i])<1e-14)throw Error('Singular acoustic network; adjust damping or route.');
    [a[i],a[pivot]]=[a[pivot],a[i]];const divisor=a[i][i];for(let k=i;k<=n;k++)a[i][k]=div(a[i][k],divisor);
    for(let j=0;j<n;j++){if(j===i)continue;const factor=a[j][i];for(let k=i;k<=n;k++)a[j][k]=sub(a[j][k],mul(factor,a[i][k]));}
  }
  return a.map(row=>row[n]);
}
export function solveNetwork(p:Project,g:Geometry,f:number) {
  const m=driverModel(p),mounts=g.mounts,positions=[...new Set([0,...mounts.map(v=>v.position*g.lineLength),g.lineLength])].sort((a,b)=>a-b);
  const n=positions.length,total=n+mounts.length,omega=2*Math.PI*f;
  const matrix:C[][]=Array.from({length:total},()=>Array.from({length:total},():C=>[0,0])),rhs:C[]=Array.from({length:total},():C=>[0,0]);
  const stamp=(i:number,j:number,value:C)=>matrix[i][j]=add(matrix[i][j],value);
  const segments:Matrix[]=[];
  for(let i=1;i<n;i++){const mat=profileMatrix(p,g,f,positions[i-1],positions[i]);segments.push(mat);const inv=div([1,0],mat.b);stamp(i-1,i-1,mul(mat.d,inv));stamp(i-1,i,scale(inv,-1));stamp(i,i-1,scale(inv,-1));stamp(i,i,mul(mat.a,inv));}
  const mouthArea=p.layout?p.layout.mouth.width*g.innerDepth*1e-6:g.sections.at(-1)!.area*1e-6;
  const end=radiation(f,mouthArea,m.c,m.rho);stamp(n-1,n-1,div([1,0],end));
  const models=mounts.map(mount=>driverModel({...p,driver:mount.driver}));
  const voltages:C[]=mounts.map(mount=>[p.design.voltage*mount.voltageScale*Math.cos(mount.phase*Math.PI/180),p.design.voltage*mount.voltageScale*Math.sin(mount.phase*Math.PI/180)]);
  const zes:C[]=mounts.map(mount=>[mount.driver.re,omega*mount.driver.le*1e-3]);
  mounts.forEach((mount,i)=>{
    const model=models[i],node=positions.indexOf(mount.position*g.lineLength),ze=zes[i];
    stamp(node,n+i,[-model.sd,0]);stamp(n+i,node,[model.sd,0]);
    const zm=add([model.rmd,omega*model.mmd-1/(omega*model.cms)],scale(radiation(f,model.sd,model.c,model.rho),model.sd**2));
    stamp(n+i,n+i,add(zm,div([model.bl**2,0],ze)));rhs[n+i]=div(scale(voltages[i],model.bl),ze);
  });
  const solution=solve(matrix,rhs),velocities=solution.slice(n),pressures=solution.slice(0,n),ut=div(pressures[n-1],end);
  const cone=velocities.reduce((sum,v,i)=>add(sum,scale(v,models[i].sd)),[0,0] as C),coefficient:C=[0,m.rho*omega/(2*Math.PI)],pressure=mul(coefficient,sub(cone,ut));
  const currents=velocities.map((v,i)=>div(sub(voltages[i],scale(v,models[i].bl)),zes[i]));
  const common=mounts.every(v=>v.voltageScale===mounts[0].voltageScale&&v.phase===mounts[0].phase),reference=Math.max(0,mounts.findIndex(v=>v.voltageScale>0));
  const current=common?currents.reduce(add,[0,0] as C):currents[reference],z=abs(current)>1e-14?div(voltages[reference],current):[1e12,0] as C;
  const db=(v:C)=>20*Math.log10(Math.max(1e-12,abs(v))/20e-6);
  const drivers=mounts.map((mount,i)=>({id:mount.id,excursion:Math.SQRT2*abs(velocities[i])/omega*1000,impedance:abs(currents[i])>1e-14?abs(div(voltages[i],currents[i])):1e12,current:abs(currents[i])}));
  const point:Point={frequency:f,spl:db(pressure),coneSpl:db(mul(coefficient,cone)),terminusSpl:db(mul(coefficient,ut)),impedance:abs(z),impedancePhase:Math.atan2(z[1],z[0])*180/Math.PI,excursion:Math.max(...drivers.map(v=>v.excursion)),velocity:Math.SQRT2*abs(ut)/mouthArea,pressureRe:pressure[0],pressureIm:pressure[1],phase:Math.atan2(pressure[1],pressure[0]),groupDelay:0,drivers};
  return {point,positions,pressures,segments,common};
}
export function simulateNetwork(p:Project,count=240):Simulation {
  const g=buildGeometry(p);if(g.errors.length)throw Error('Cannot simulate invalid geometry: '+g.errors.join(' '));
  const m=driverModel(p),frequencies=[...new Set([...Array.from({length:count},(_,i)=>15*(800/15)**(i/(count-1))),p.targets.low,p.targets.high,Math.sqrt(p.targets.low*p.targets.high)])].sort((a,b)=>a-b);
  const points=frequencies.map(f=>solveNetwork(p,g,f).point);let offset=0,previous=points[0].phase;
  for(let i=1;i<points.length;i++){const raw=points[i].phase,delta=raw-previous;if(delta>Math.PI)offset-=2*Math.PI;if(delta< -Math.PI)offset+=2*Math.PI;previous=raw;points[i].phase=raw+offset;}
  for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];points[i].groupDelay=-(b.phase-a.phase)/(2*Math.PI*(b.frequency-a.frequency))*1000;}
  const band=points.filter(v=>v.frequency>=p.targets.low&&v.frequency<=p.targets.high),mean=band.reduce((sum,v)=>sum+v.spl,0)/band.length;let f3:number|null=null;
  for(let i=1;i<points.length&&points[i].frequency<=Math.sqrt(p.targets.low*p.targets.high);i++){const a=points[i-1],b=points[i];if(a.spl<mean-3&&b.spl>=mean-3)f3=a.frequency*(b.frequency/a.frequency)**((mean-3-a.spl)/(b.spl-a.spl));}
  return {points,quarterWave:m.c/(4*g.lineLength),planeWaveLimit:m.c/(2*Math.max(g.innerDepth,...g.sections.map(s=>s.width))*1e-3),radiationLimit:m.c/(2*Math.PI*Math.sqrt(Math.max(...g.sections.map(s=>s.area*1e-6),...g.mounts.map(s=>s.driver.sd*1e-4))/Math.PI)),peakExcursion:Math.max(...points.map(v=>v.excursion)),peakVelocity:Math.max(...points.map(v=>v.velocity)),bandMean:mean,ripple:Math.max(...band.map(v=>v.spl))-Math.min(...band.map(v=>v.spl)),f3,impedanceConvention:g.mounts.every(v=>v.voltageScale===g.mounts[0].voltageScale&&v.phase===g.mounts[0].phase)?'common-parallel-input':'first-driven-source'};
}
export function networkPressure(p:Project,frequency:number,samples=100) {
  const g=buildGeometry(p);if(g.errors.length)return [];
  const solved=solveNetwork(p,g,frequency);
  const values=Array.from({length:samples},(_,i)=>{
    const s=i/(samples-1)*g.lineLength;let at=solved.positions.findIndex(v=>v>=s);at=Math.max(1,at);
    const a=at-1,mat=solved.segments[a],u=div(sub(mul(mat.d,solved.pressures[a]),solved.pressures[at]),mat.b),part=profileMatrix(p,g,frequency,solved.positions[a],s);
    return {s,pressure:abs(sub(mul(part.d,solved.pressures[a]),mul(part.b,u)))};
  });const max=Math.max(...values.map(v=>v.pressure),1e-20);return values.map(v=>({...v,pressure:v.pressure/max}));
}
