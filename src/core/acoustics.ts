import { abs,add,sub,mul,div,scale,sinh,cosh,type C } from './complex';
import type { Project, Simulation, Point } from './types';
import { buildGeometry } from './geometry';
import { simulateNetwork, networkPressure } from './network-acoustics';
export const soundSpeed=(temperature:number)=>331.3+0.606*temperature;
export function driverModel(p:Project) {
  const c=soundSpeed(p.design.temperature),rho=1.2041*293.15/(273.15+p.design.temperature),v=p.driver;
  const sd=v.sd*1e-4,ws=2*Math.PI*v.fs,cms=v.vas*1e-3/(rho*c*c*sd*sd),mms=1/(ws*ws*cms);
  const rms=ws*mms/v.qms,freeRadiation=radiation(v.fs,sd,c,rho);
  // T/S Mms/Qms already include free-air loading on both cone faces.
  // Calibrate the suspension mass/resistance before replacing rear air with a line.
  const mmd=mms-2*sd*sd*freeRadiation[1]/ws,rmd=rms-2*sd*sd*freeRadiation[0];
  return {c,rho,sd,cms,mms,rms,mmd,rmd,bl:Math.sqrt(ws*mms*v.re/v.qes),qts:1/(1/v.qes+1/v.qms)};
}
// Low-ka baffled equivalent circular piston radiation impedance, Pa·s/m³.
export function radiation(f:number,area:number,c:number,rho:number):C {
  const ka=2*Math.PI*f/c*Math.sqrt(area/Math.PI),z=rho*c/area;
  return [z*ka*ka/2,z*8*ka/(3*Math.PI)];
}
export function lineMatrix(f:number,length:number,area:number,c:number,rho:number,damping:number) {
  const gamma:C=[damping*Math.sqrt(f/100),2*Math.PI*f/c],z=rho*c/area;
  const a=cosh(scale(gamma,length)),s=sinh(scale(gamma,length));
  return {a,b:scale(s,z),c:scale(s,1/z),d:a};
}
export function simulate(p:Project,count=240):Simulation {
  if(p.layout||p.mounts?.length)return simulateNetwork(p,count);
  const m=driverModel(p),{design:d,driver:v}=p,g=buildGeometry(p),area=g.area*1e-6,x=d.length*d.driverPosition;
  const points:Point[]=[];
  // Include target edges and midpoint so even a very narrow valid brief has band samples.
  const frequencies=[...new Set([...Array.from({length:count},(_,i)=>15*(800/15)**(i/(count-1))),p.targets.low,p.targets.high,Math.sqrt(p.targets.low*p.targets.high)])].sort((a,b)=>a-b);
  for(const f of frequencies) {
    const omega=2*Math.PI*f;
    const end=radiation(f,area,m.c,m.rho),front=radiation(f,m.sd,m.c,m.rho);
    const stub=lineMatrix(f,x,area,m.c,m.rho,d.damping),down=lineMatrix(f,d.length-x,area,m.c,m.rho,d.damping);
    const zs=div(stub.a,stub.c),zd=div(add(mul(down.a,end),down.b),add(mul(down.c,end),down.d));
    const rear=div(mul(zs,zd),add(zs,zd));
    const zm=add([m.rmd,omega*m.mmd-1/(omega*m.cms)],scale(add(rear,front),m.sd*m.sd));
    const ze:C=[v.re,omega*v.le*1e-3];
    const velocity=div([m.bl*d.voltage,0],add(mul(ze,zm),[m.bl*m.bl,0]));
    const current=div(sub([d.voltage,0],scale(velocity,m.bl)),ze);
    const z=div([d.voltage,0],current),u=scale(velocity,m.sd);
    const ud=mul(u,div(zs,add(zs,zd))),ut=div(ud,add(mul(down.c,end),down.d));
    // Rear radiation has opposite polarity to the front of the cone.
    const coefficient:C=[0,m.rho*omega/(2*Math.PI)];
    const pressure=mul(coefficient,sub(u,ut));
    const db=(a:C)=>20*Math.log10(Math.max(1e-12,abs(a))/20e-6);
    points.push({frequency:f,spl:db(pressure),coneSpl:db(mul(coefficient,u)),terminusSpl:db(mul(coefficient,ut)),impedance:abs(z),impedancePhase:Math.atan2(z[1],z[0])*180/Math.PI,excursion:Math.SQRT2*abs(velocity)/omega*1000,velocity:Math.SQRT2*abs(ut)/area,pressureRe:pressure[0],pressureIm:pressure[1],phase:Math.atan2(pressure[1],pressure[0]),groupDelay:0});
  }
  let previous=points[0].phase,offset=0;
  for(let i=1;i<points.length;i++) {
    const raw=points[i].phase,delta=raw-previous;
    if(delta>Math.PI) offset-=2*Math.PI;
    if(delta<-Math.PI) offset+=2*Math.PI;
    previous=raw; points[i].phase=raw+offset;
  }
  for(let i=0;i<points.length;i++) {
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    points[i].groupDelay=-(b.phase-a.phase)/(2*Math.PI*(b.frequency-a.frequency))*1000;
  }
  const band=points.filter(pt=>pt.frequency>=p.targets.low && pt.frequency<=p.targets.high),spl=band.map(pt=>pt.spl),mean=spl.reduce((a,b)=>a+b,0)/spl.length;
  // Low-frequency crossing leading into the target band; null means no crossing in sweep.
  let f3:number|null=null;
  for(let i=1;i<points.length && points[i].frequency<=Math.sqrt(p.targets.low*p.targets.high);i++) {
    const a=points[i-1],b=points[i];
    if(a.spl<mean-3 && b.spl>=mean-3) f3=a.frequency*(b.frequency/a.frequency)**((mean-3-a.spl)/(b.spl-a.spl));
  }
  return {points,quarterWave:m.c/(4*d.length),planeWaveLimit:m.c/(2*Math.max(g.lane,g.innerDepth)*1e-3),radiationLimit:m.c/(2*Math.PI*Math.sqrt(Math.max(area,m.sd)/Math.PI)),peakExcursion:Math.max(...points.map(pt=>pt.excursion)),peakVelocity:Math.max(...points.map(pt=>pt.velocity)),bandMean:mean,ripple:Math.max(...spl)-Math.min(...spl),f3};
}
export function standingWave(p:Project,frequency:number,samples=100) {
  if(p.layout||p.mounts?.length)return networkPressure(p,frequency,samples);
  const m=driverModel(p),area=p.driver.sd*1e-4*p.design.areaRatio,d=p.design,x=d.length*d.driverPosition;
  const stub=lineMatrix(frequency,x,area,m.c,m.rho,d.damping),down=lineMatrix(frequency,d.length-x,area,m.c,m.rho,d.damping),end=radiation(frequency,area,m.c,m.rho);
  const inletPressure=add(mul(down.a,end),down.b);
  const values=Array.from({length:samples},(_,i)=>{
    const s=i/(samples-1)*d.length;
    if(s<x) return {s,pressure:abs(mul(div(lineMatrix(frequency,s,area,m.c,m.rho,d.damping).a,stub.a),inletPressure))};
    const mat=lineMatrix(frequency,d.length-s,area,m.c,m.rho,d.damping);
    return {s,pressure:abs(add(mul(mat.a,end),mat.b))};
  });
  const max=Math.max(...values.map(v=>v.pressure));
  return values.map(v=>({...v,pressure:v.pressure/max}));
}
