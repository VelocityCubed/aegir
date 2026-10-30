import type { Project, Geometry, Panel } from './types';
import { buildCustomGeometry } from './layout';
export function buildGeometry(p: Project): Geometry {
  if(p.layout)return buildCustomGeometry(p);
  if(p.mounts?.length)return buildCustomGeometry({...editableLayout({...p,mounts:undefined}),mounts:p.mounts});
  const {design:d,driver:v}=p, n=d.folds,t=d.thickness,w=d.laneWidth;
  const area=v.sd*100*d.areaRatio, dep=area/w;
  // Rectilinear centreline including equal-width turn clearances: L = N H + (N-1)t.
  const h=(d.length*1000-(n-1)*t)/n, iw=n*w+(n-1)*t;
  const W=iw+2*t,H=h+2*t,D=dep+2*t;
  const cy=t+h-d.length*1000*d.driverPosition, cx=t+w/2;
  const panels:Panel[]=[];
  const panel=(id:string,label:string,width:number,height:number,position:Panel['position'],rotation:Panel['rotation']=[0,0,0],holes:Panel['holes']=[])=>panels.push({id,label,width,height,thickness:t,position,rotation,holes});
  panel('front','Front baffle',W,H,[W/2,H/2,t/2],[0,0,0],[{x:cx-W/2,y:cy-H/2,radius:v.cutout/2}]);
  panel('back','Back panel',W,H,[W/2,H/2,D-t/2]);
  panel('left','Left side',dep,H,[t/2,H/2,D/2],[0,Math.PI/2,0]);
  panel('right','Right side',dep,H,[W-t/2,H/2,D/2],[0,Math.PI/2,0]);
  const mouthAtTop=n%2===0;
  // End panels sit between the sides; the final lane is deliberately left open.
  const topWidth=mouthAtTop?iw-w:iw, bottomWidth=mouthAtTop?iw:iw-w;
  if(topWidth>0) panel('top','Top cap',topWidth,dep,[t+topWidth/2,H-t/2,D/2],[Math.PI/2,0,0]);
  if(bottomWidth>0) panel('bottom','Bottom cap',bottomWidth,dep,[t+bottomWidth/2,t/2,D/2],[Math.PI/2,0,0]);
  for(let j=0;j<n-1;j++) {
    const gapAtBottom=j%2===0;
    panel(`divider-${j+1}`,`Divider ${j+1}`,dep,h-w,[t+(j+1)*w+j*t+t/2,t+(gapAtBottom?w:0)+(h-w)/2,D/2],[0,Math.PI/2,0]);
  }
  const path:Geometry['path']=[[cx,t+h,D/2]];
  for(let j=0;j<n;j++) {
    const x=t+w/2+j*(w+t), down=j%2===0;
    const endY=j===n-1?(down?t:t+h):(down?t+w/2:t+h-w/2);
    path.push([x,endY,D/2]);
    if(j<n-1) path.push([x+w+t,endY,D/2]);
  }
  const errors:string[]=[],warnings:string[]=[];
  if(h<2*w) errors.push('Line is too short for these passes and turn clearances. Increase length, reduce lane width or use fewer passes.');
  if(w<v.cutout+12) errors.push('Driver cutout needs at least 6 mm of clearance on each side of the first lane.');
  if(cy-v.frame/2<t+6 || cy+v.frame/2>H-t-6) errors.push('Driver frame does not fit vertically. Move the driver along the first pass.');
  if(cx-v.frame/2<6 || cx+v.frame/2>W-6) errors.push('Driver frame overhangs the front baffle. Increase lane width.');
  if(d.length*1000*d.driverPosition+v.cutout/2>h-w) errors.push('Driver overlaps the first turn. Reduce driver position or use fewer passes.');
  if(dep<v.depth+15) errors.push('Driver magnet needs 15 mm clearance to the back. Increase area ratio or reduce lane width.');
  if(n%2!==0) warnings.push('Mouth exits through the bottom. Fit a stand with free clearance; floor loading is not modelled.');
  if(W>p.targets.maxWidth || H>p.targets.maxHeight || D>p.targets.maxDepth) warnings.push('Cabinet exceeds one or more optimisation size limits.');
  if(d.damping>1.5) warnings.push('High damping is an assumed distributed loss, not a verified stuffing recipe.');
  warnings.push('Square folds, driver displacement, bracing and stuffing need prototype validation.');
  // Actual clear cavity volume from the same boards, not the 1D S×L approximation.
  const airVolume=(iw*h-(n-1)*t*(h-w))*dep/1e6;
  const mounts=(p.mounts?.length?p.mounts:[{id:'primary',driver:v,position:d.driverPosition,face:'front' as const,voltageScale:1,phase:0}]).map(m=>{
    let remaining=d.length*1000*m.position,center:[number,number,number]=[cx,cy,m.face==='front'?0:D];
    for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(remaining<=len){center=[a[0]+(b[0]-a[0])*remaining/len,a[1]+(b[1]-a[1])*remaining/len,m.face==='front'?0:D];break;}remaining-=len;}
    return {...m,center};
  });
  if(p.mounts?.length){panels[0].holes=[];panels[1].holes=[];for(const m of mounts){panels[m.face==='front'?0:1].holes.push({x:m.center[0]-W/2,y:m.center[1]-H/2,radius:m.driver.cutout/2});}}
  return {width:W,height:H,depth:D,innerHeight:h,innerDepth:dep,lane:w,area,airVolume,panels,path,driverCenter:mounts[0].center,errors,warnings,lineLength:d.length,sections:[{distance:0,area,width:w,damping:d.damping},{distance:d.length,area,width:w,damping:d.damping}],mounts};
}
export function editableLayout(p:Project):Project {
  if(p.layout)return structuredClone(p);
  const g=buildGeometry(p),t=p.design.thickness,n=p.design.folds,w=p.design.laneWidth,h=g.innerHeight;
  return {...structuredClone(p),layout:{width:g.width,height:g.height,depth:g.depth,baffles:Array.from({length:n-1},(_,i)=>({id:`baffle-${i+1}`,label:`Baffle ${i+1}`,start:[(i+1)*w+i*t+t/2,i%2===0?w:0],end:[(i+1)*w+i*t+t/2,i%2===0?h:h-w],thickness:t})),route:g.path.map(([x,y])=>[x-t,y-t]),mouth:{side:n%2===0?'top':'bottom',offset:n*w+(n-1)*t-w/2,width:w}}};
}
