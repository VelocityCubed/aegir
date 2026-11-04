import type {Project} from '../src/core/types';
/** Inputs selected from the PDF before extracting/comparing predictions. */
export function anatomyCases():Record<string,Project>{
 const source='Martin J. King, Anatomy of a Transmission Line Loudspeaker, revised 2006-10-18, http://quarter-wave.com/TLs/TL_Anatomy.pdf';
 const length=67.5*25.4/1000,thickness=18,width=200;
 const driver={id:'mjk-anatomy-generic-2006',name:'King 2006 · published generic driver',note:`SOURCE: ${source}; PDF p25/printed p24: Fs50Hz, Re8ohm, Le0mH, Sd200cm², Qms6, Qts0.4, Vas21.920L. DERIVED Qes=3/7. Generic simulation data, not a manufacturer driver. ASSUMED schematic-only cutout160/frame180/depth60mm and Xmax1mm (unknown actual limit); do not infer headroom or fabricate from these placeholders.`,fs:50,re:8,le:0,sd:200,qms:6,qes:3/7,vas:21.920,cutout:160,frame:180,depth:60,xmax:1};
 const base:Project={version:1,name:'King 2006 · straight TL · empty · published generic driver',driver,
  design:{length,areaRatio:2,laneWidth:width,folds:1,thickness,driverPosition:.01,damping:0,voltage:Math.sqrt(8),temperature:20},
  targets:{low:30,high:200,maxHeight:2500,maxWidth:600,maxDepth:600,minLength:.5,maxLength:3,maxVelocity:17},
  layout:{width:width+2*thickness,height:length*1000+2*thickness,depth:width+2*thickness,baffles:[],route:[[width/2,length*1000],[width/2,0]],mouth:{side:'bottom',offset:width/2,width}},
  mounts:[{id:'primary',driver,position:.0001,face:'top',at:[width/2+thickness,width/2+thickness],voltageScale:1,phase:0,rearLoading:'cabinet'}],
  system:{sweep:[10,1000],distanceM:1,air:{densityKgM3:1.21,soundSpeedMs:343,source:`SOURCE c343m/s: ${source}, PDF p18. ASSUMED rho1.21kg/m³ from King's historical air convention; p25 derived table suggests c342 instead. Sensitivity retained, no graph fitting.`},numerics:{lineStepMm:10},physics:{ductLoss:'mjk-2003',radiation:'piston',stuffing:[]},references:[]}
 };
 const stuffed=structuredClone(base);stuffed.name='King 2006 · straight TL · 0.5 lb/ft³ · published generic driver';stuffed.system!.physics!.stuffing=[{start:0,end:1,source:`SOURCE full-length0.5lb/ft³: ${source}, PDF p31; ASSUMED historical2003 propagation law transferred to2006 (not independently calibrated).`,calibration:'assumed',material:{model:'mjk-2003',densityKgM3:.5*16.0184634}}];
 return {empty:base,stuffed};
}
