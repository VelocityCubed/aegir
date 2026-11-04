import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {anatomyCases} from './anatomy-cases';
import {validateProject} from '../src/core/validation';
import {buildGeometry} from '../src/core/geometry';
import {simulateNetwork,solveNetwork,profileMatrix} from '../src/core/network-acoustics';
import {closedOpenModes} from '../src/core/system';
import {driverModel,radiation} from '../src/core/acoustics';
import {abs,add,sub,mul,div,scale} from '../src/core/complex';
import {compareReference} from '../src/core/system';
import type {Project} from '../src/core/types';
const out='test-results/anatomy',models='docs/speaker-design/models';mkdirSync(out,{recursive:true});
const cases=anatomyCases(),source=JSON.parse(readFileSync('examples/anatomy-2006-traces.json','utf8'));
const report:any={source:source.source,sourceSha256:source.sha256,scope:'Unfitted published-simulation comparison. Generic author-specified driver. No physical measurements or original MathCad worksheet available.',inputs:'scripts/anatomy-cases.ts',cases:[],sensitivity:[],unverified:['Reference excitation voltage and far-field distance are not explicitly exposed in the PDF; absolute SPL differences are diagnostic, not acceptance. No level or frequency offset fitted.','Source text says c343m/s, but printed driver derivation is more consistent with c342m/s; both retained without selecting by agreement.','18mm stock and schematic mechanical driver dimensions are implementation assumptions; source gives an ideal constant-area line. No fabrication or headroom claim.','Historical2003 empty/fibre law transferred to2006 as an assumption.','Source labels its directly-derived mass Mmd; Aegir derives Mms then removes two free-air piston loads. These conventions may differ.','The 2006 reference is a published generic-driver simulation, not a built measured loudspeaker.']};
const csv=(rows:any[])=>Object.keys(rows[0]).join(',')+'\n'+rows.map(r=>Object.values(r).join(',')).join('\n')+'\n';
function peaks(points:any[],key:string,low=10,high=500){return points.flatMap((p,i)=>i>0&&i<points.length-1&&p.frequency>=low&&p.frequency<=high&&p[key]>points[i-1][key]&&p[key]>=points[i+1][key]?[{frequency:p.frequency,value:p[key]}]:[]);}
for(const [id,p] of Object.entries(cases)){
 validateProject(p);const g=buildGeometry(p);if(g.errors.length)throw Error(id+': '+g.errors.join('; '));
 const s=simulateNetwork(p,1001),refs=source.traces.filter((t:any)=>t.case===id).map((t:any)=>({id:t.id,title:t.id,source:source.source+'; PDF p'+t.page,evidence:'published-simulation' as const,metric:t.metric,trace:t.trace,conditions:{voltage:t.metric==='impedance'?null:null,distanceM:t.metric==='impedance'?null:null,radiation:'half-space' as const,stuffing:id==='empty'?'empty' as const:'stuffed' as const,crossover:'bypass' as const},samples:t.samples.filter((s:number[])=>s[0]<=800),tolerance:t.metric==='impedance'?2:1,uncertainty:t.uncertainty,frequencyUncertaintyPercent:t.frequencyUncertaintyPercent}));
 p.system!.references=refs;
 writeFileSync(`${models}/Anatomy-2006-straight-${id}.aegir.json`,JSON.stringify(p,null,2));
 const comparisons=refs.map((r:any)=>compareReference(p,s,r));
 const rows=s.points.map(v=>({frequency:v.frequency,impedance:v.impedance,impedancePhase:v.impedancePhase,systemSpl:v.spl,coneSpl:v.coneSpl,terminusSpl:v.terminusSpl,pressureRe:v.pressureRe,pressureIm:v.pressureIm,excursion:v.excursion,terminusSpeed:v.velocity,groupDelay:v.groupDelay}));
 writeFileSync(`${out}/${id}-prediction.csv`,csv(rows));
 const curveRows=comparisons.flatMap((c:any)=>c.rows.filter((r:any)=>r.actual!==null).map((r:any)=>({trace:c.id,...r})));writeFileSync(`${out}/${id}-residuals.csv`,csv(curveRows));
 const modes=closedOpenModes(p,500);
 const keyFreqs=[32,50,68,149,242];const profiles=keyFreqs.map(f=>{const solved=solveNetwork(p,g,f);return {frequency:f,samples:Array.from({length:101},(_,i)=>{const x=g.lineLength*i/100;let at=solved.positions.findIndex(v=>v>=x);at=Math.max(1,at);const a=at-1,mat=solved.segments[a],u=div(sub(mul(mat.d,solved.pressures[a]),solved.pressures[at]),mat.b),part=profileMatrix(p,g,f,solved.positions[a],x),pressure=sub(mul(part.d,solved.pressures[a]),mul(part.b,u)),flux=sub(mul(part.a,u),mul(part.c,solved.pressures[a]));return {fraction:i/100,pressureRe:pressure[0],pressureIm:pressure[1],pressureMagnitude:abs(pressure),velocityRe:flux[0]/.04,velocityIm:flux[1]/.04};})};});
 const zPeaks=peaks(s.points,'impedance');
 const sourcePeakFreqs=id==='empty'?[32,68,149,242]:[];
 const peakErrors=sourcePeakFreqs.map(expected=>{const found=zPeaks.reduce((a,b)=>Math.abs(Math.log(b.frequency/expected))<Math.abs(Math.log(a.frequency/expected))?b:a);return {sourceHz:expected,modelHz:found.frequency,errorPercent:(found.frequency/expected-1)*100,modelOhm:found.value};});
 report.cases.push({id,project:`${models}/Anatomy-2006-straight-${id}.aegir.json`,geometry:{width:g.width,height:g.height,depth:g.depth,lineLength:g.lineLength,airVolumeLitres:g.airVolume,sections:g.sections,driverPositions:g.mounts.map(m=>m.position),errors:g.errors},driverModel:driverModel(p),impedancePeaks:zPeaks,sourcePeakFrequencyErrors:peakErrors,idealUnloadedModes:modes,comparisons,profiles,simulation:rows,modelLimits:{planeWaveLimit:s.planeWaveLimit,radiationLimit:s.radiationLimit}});
}
// Isolated numerical/model sensitivities; no variant is selected by graph residual.
for(const [name,mutate] of Object.entries({textLength67_3in:(p:Project)=>{p.design.length=67.3*.0254;p.layout!.height=p.design.length*1000+2*p.design.thickness;p.layout!.route[0][1]=p.design.length*1000;},air342:(p:Project)=>{p.system!.air!.soundSpeedMs=342;},noDuctLoss:(p:Project)=>{p.system!.physics!.ductLoss='none';},thermoviscous:(p:Project)=>{p.system!.physics!.ductLoss='thermoviscous';},lineStep5mm:(p:Project)=>{p.system!.numerics!.lineStepMm=5;}})){
 const p=structuredClone(cases.empty);mutate(p);const s=simulateNetwork(p,1001);let delta2=0,base2=0;const baseRows=report.cases[0].simulation;s.points.forEach((v,i)=>{delta2+=(v.pressureRe!-baseRows[i].pressureRe)**2+(v.pressureIm!-baseRows[i].pressureIm)**2;base2+=baseRows[i].pressureRe**2+baseRows[i].pressureIm**2;});report.sensitivity.push({name,relativeComplexPressureL2:Math.sqrt(delta2/base2),impedancePeaks:peaks(s.points,'impedance'),impedanceComparison:compareReference(p,s,p.system!.references!.find(r=>r.metric==='impedance')!)});
}
for(const c of report.cases){
 const cone=source.traces.find((t:any)=>t.case===c.id&&t.metric==='coneSpl'),mouth=source.traces.find((t:any)=>t.case===c.id&&t.metric==='terminusSpl');
 const paired=mouth.samples.filter(([f]:number[])=>f<=800&&cone.samples.some(([g]:number[])=>Math.abs(f-g)<1e-9));
 const relativeRows=paired.map(([f,port]:number[])=>{const driver=cone.samples.find(([g]:number[])=>Math.abs(f-g)<1e-9)[1],i=c.simulation.findIndex((r:any)=>r.frequency>=f),a=c.simulation[Math.max(0,i-1)],b=c.simulation[i],t=Math.log(f/a.frequency)/(Math.log(b.frequency/a.frequency)||1),actual=(a.terminusSpl-a.coneSpl)*(1-t)+(b.terminusSpl-b.coneSpl)*t,expected=port-driver;return {frequency:f,expected,actual,error:actual-expected};});
 c.openingToDriverRatio={scope:'Paired far-field contributions: subtract opening and driver dB values, cancelling a common excitation/observation gain. Assumes both source traces use the common far-field convention suggested by the figure; no fitted normalization.',rows:relativeRows,rmse:Math.sqrt(relativeRows.reduce((s:number,r:any)=>s+r.error*r.error,0)/relativeRows.length),meanError:relativeRows.reduce((s:number,r:any)=>s+r.error,0)/relativeRows.length,maxError:Math.max(...relativeRows.map((r:any)=>Math.abs(r.error))),uncertaintyDb:2};
 c.profileComparisons=source.profiles.filter((t:any)=>t.case===c.id).map((t:any)=>{
   const model=c.profiles.find((p:any)=>p.frequency===t.frequency).samples,rows=t.samples.map(([fraction,expected]:number[])=>{const x=fraction*100,i=Math.min(99,Math.floor(x)),a=model[i],b=model[i+1],v=a[t.metric]+(b[t.metric]-a[t.metric])*(x-i);return {fraction,expected,actual:v,error:v-expected};});
   return {frequency:t.frequency,metric:t.metric,units:t.units,uncertainty:t.uncertainty,page:t.page,rows,rmse:Math.sqrt(rows.reduce((s:number,r:any)=>s+r.error*r.error,0)/rows.length),status:'diagnostic-only',issues:['Reference excitation magnitude and phase convention are not fully specified; no amplitude/phase alignment fitted.']};
 });
}
{
 const p=cases.empty,g=buildGeometry(p),m=driverModel(p),values=report.cases[0].simulation.map((row:any)=>{const f=row.frequency,mat=profileMatrix(p,g,f,0,g.lineLength),load=radiation(f,.04,m.c,m.rho,'piston'),z=div(add(mul(mat.a,load),mat.b),add(mul(mat.c,load),mat.d));return {frequency:f,normalizedMagnitude:abs(z)/(m.rho*m.c),phaseDeg:Math.atan2(z[1],z[0])*180/Math.PI};});
 report.acousticLoad={scope:'Unit-volume-flow enclosure input load, without the driver, divided by rho*c as in PDF Figure15. Exact same Aegir line/material and piston-radiation routines.',values,comparisons:source.acousticTraces.map((t:any)=>{const rows=t.samples.filter(([f]:number[])=>f<=800).map(([f,expected]:number[])=>{const i=values.findIndex((r:any)=>r.frequency>=f),a=values[Math.max(0,i-1)],b=values[i],fraction=Math.log(f/a.frequency)/(Math.log(b.frequency/a.frequency)||1),actual=a[t.metric]+(b[t.metric]-a[t.metric])*fraction,error=t.metric==='phaseDeg'?((actual-expected+540)%360-180):Math.log10(actual/expected);return {frequency:f,expected,actual,error};});return {metric:t.metric,page:t.page,uncertainty:t.uncertainty,uncertaintyUnits:t.uncertaintyUnits,rows,rmse:Math.sqrt(rows.reduce((s:number,r:any)=>s+r.error*r.error,0)/rows.length),maxError:Math.max(...rows.map((r:any)=>Math.abs(r.error)))};}),peaks:peaks(values,'normalizedMagnitude')};
 report.freeAirIdentity={source:'PDF Figure17 and p25 parameters',frequencyHz:50,sourcePeakOhm:120,derivedFromTSOhm:p.driver.re*(1+p.driver.qms/p.driver.qes),scope:'Algebraic T/S consistency, not independent physical validation.'};
}
writeFileSync(`${out}/comparison.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({cases:report.cases.map((c:any)=>({id:c.id,geometryErrors:c.geometry.errors,peaks:c.sourcePeakFrequencyErrors,comparisons:c.comparisons.map((r:any)=>({id:r.id,status:r.status,rmse:r.rmse,maxError:r.maxError,issues:r.issues}))})),output:out},null,2));
