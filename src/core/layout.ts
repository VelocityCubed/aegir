import type { Baffle, CustomLayout, Geometry, Panel, Project, Section, XY } from './types';

export const distance=(a:XY,b:XY)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const topologyCache=new Map<string,string|null>();
const cross=(a:XY,b:XY)=>a[0]*b[1]-a[1]*b[0];
export function pointSegmentDistance(p:XY,a:XY,b:XY) {
  const l=(b[0]-a[0])**2+(b[1]-a[1])**2;
  const t=l?Math.max(0,Math.min(1,((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/l)):0;
  return distance(p,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
}
export function routeLength(points:XY[]) { return points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0); }
export function pointOnRoute(points:XY[],s:number):XY {
  if(!points.length)return [0,0];
  for(let i=1;i<points.length;i++){const l=distance(points[i-1],points[i]);if(s<=l)return [points[i-1][0]+(points[i][0]-points[i-1][0])*s/l,points[i-1][1]+(points[i][1]-points[i-1][1])*s/l];s-=l;}
  return [...points.at(-1)!];
}
export function mouthPoint(l:CustomLayout,t:number):XY {
  const w=l.width-2*t,h=l.height-2*t;
  return l.mouth.side==='top'?[l.mouth.offset,h]:l.mouth.side==='bottom'?[l.mouth.offset,0]:l.mouth.side==='left'?[0,l.mouth.offset]:[w,l.mouth.offset];
}
export function bafflePolygon(b:Baffle,t:number,w:number,h:number):XY[] {
  const len=distance(b.start,b.end);if(!len)return [];
  const n:XY=[-(b.end[1]-b.start[1])/len*(b.thickness??t)/2,(b.end[0]-b.start[0])/len*(b.thickness??t)/2];
  let polygon:XY[]=[[b.start[0]+n[0],b.start[1]+n[1]],[b.end[0]+n[0],b.end[1]+n[1]],[b.end[0]-n[0],b.end[1]-n[1]],[b.start[0]-n[0],b.start[1]-n[1]]];
  // Clip boards at the cavity walls, retaining exact mitred solid footprints.
  for(const [axis,bound,sign] of [[0,0,1],[0,w,-1],[1,0,1],[1,h,-1]]) {
    const out:XY[]=[];
    for(let i=0;i<polygon.length;i++) {
      const a=polygon[i],b=polygon[(i+1)%polygon.length],da=(a[axis]-bound)*sign,db=(b[axis]-bound)*sign;
      if(da>=-1e-8)out.push(a);
      if((da<0&&db>0)||(da>0&&db<0)){const r=da/(da-db);out.push([a[0]+r*(b[0]-a[0]),a[1]+r*(b[1]-a[1])]);}
    }
    polygon=out;
  }
  return polygon;
}
export function insidePolygon(p:XY,poly:XY[]) {
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function polygonArea(poly:XY[]) {return Math.abs(poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+cross(a,b);},0))/2;}
function intersectionArea(a:XY[],b:XY[]){
  let result=a;const orientation=Math.sign(b.reduce((sum,p,i)=>sum+cross(p,b[(i+1)%b.length]),0));
  for(let i=0;i<b.length;i++){const from=b[i],to=b[(i+1)%b.length],edge:XY=[to[0]-from[0],to[1]-from[1]],out:XY[]=[];
    const side=(p:XY)=>cross(edge,[p[0]-from[0],p[1]-from[1]])*orientation;
    for(let j=0;j<result.length;j++){const p=result[j],q=result[(j+1)%result.length],u=side(p),v=side(q);if(u>=-1e-8)out.push(p);if((u<0&&v>0)||(u>0&&v<0)){const r=u/(u-v);out.push([p[0]+r*(q[0]-p[0]),p[1]+r*(q[1]-p[1])]);}}result=out;
  }return polygonArea(result);
}
export function sectionWidth(point:XY,normal:XY,w:number,h:number,polygons:XY[][]) {
  const bounds:XY[]=[[0,0],[w,0],[w,h],[0,h]];
  let positive=Infinity,negative=-Infinity;
  for(const poly of [bounds,...polygons])for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],edge:XY=[b[0]-a[0],b[1]-a[1]],delta:XY=[a[0]-point[0],a[1]-point[1]],den=cross(normal,edge);
    if(Math.abs(den)<1e-9)continue;
    const s=cross(delta,edge)/den,u=cross(delta,normal)/den;
    if(u>=-1e-7&&u<=1+1e-7){if(s>1e-6)positive=Math.min(positive,s);if(s< -1e-6)negative=Math.max(negative,s);}
  }
  return Number.isFinite(positive-negative)?positive-negative:0;
}
export function sampleSections(p:Project,samples=160):Section[] {
  const l=p.layout!;const t=p.design.thickness,w=l.width-2*t,h=l.height-2*t,depth=l.depth-2*t;
  const polygons=l.baffles.map(b=>bafflePolygon(b,t,w,h));
  const length=routeLength(l.route);
  const eps=Math.min(.5,length/10000),cuts=new Set(Array.from({length:samples+1},(_,i)=>length*i/samples));let at=0;
  for(let i=1;i<l.route.length-1;i++){at+=distance(l.route[i-1],l.route[i]);for(const delta of [-eps,0,eps])cuts.add(Math.max(0,Math.min(length,at+delta)));}
  return [...cuts].sort((a,b)=>a-b).map(s=>{
    const a=pointOnRoute(l.route,Math.max(0,Math.min(length-2*eps,s-eps))),b=pointOnRoute(l.route,Math.max(2*eps,Math.min(length,s+eps)));
    const tangent:XY=[b[0]-a[0],b[1]-a[1]],norm=Math.hypot(...tangent)||1;
    const point=pointOnRoute(l.route,Math.max(eps,Math.min(length-eps,s)));
    const width=sectionWidth(point,[-tangent[1]/norm,tangent[0]/norm],w,h,polygons);
    return {distance:s/1000,area:Math.max(.001,width*depth),width,damping:p.design.damping};
  });
}
export function buildCustomGeometry(p:Project):Geometry {
  const l=p.layout!,t=p.design.thickness,W=l.width,H=l.height,D=l.depth,w=W-2*t,h=H-2*t,dep=D-2*t;
  const length=routeLength(l.route)/1000,errors:string[]=[],warnings:string[]=[],panels:Panel[]=[];
  const add=(id:string,label:string,width:number,height:number,position:Panel['position'],rotation:Panel['rotation']=[0,0,0])=>{const panel:Panel={id,label,width,height,thickness:t,position,rotation,holes:[]};panels.push(panel);return panel;};
  const front=add('front','Front baffle',W,H,[W/2,H/2,t/2]),back=add('back','Back panel',W,H,[W/2,H/2,D-t/2]);
  for(const side of ['left','right','top','bottom'] as const) {
    const vertical=side==='left'||side==='right',span=vertical?H:w;
    const mouth=l.mouth.side===side;
    const offset=vertical?t+l.mouth.offset:l.mouth.offset;
    const ranges=mouth?[[0,offset-l.mouth.width/2],[offset+l.mouth.width/2,span]]:[[0,span]];
    ranges.forEach(([a,b],i)=>{if(b-a<.001)return;
      if(vertical)add(side+(i?'-2':''),side+' wall'+(i?' 2':''),dep,b-a,[side==='left'?t/2:W-t/2,(a+b)/2,D/2],[0,Math.PI/2,0]);
      else add(side+(i?'-2':''),side+' cap'+(i?' 2':''),b-a,dep,[t+(a+b)/2,side==='top'?H-t/2:t/2,D/2],[Math.PI/2,0,0]);
    });
  }
  const polygons=l.baffles.map(b=>bafflePolygon(b,t,w,h));
  for(let i=0;i<polygons.length;i++)for(let j=i+1;j<polygons.length;j++)if(intersectionArea(polygons[i],polygons[j])>.1)errors.push(`Baffles ${l.baffles[i].id} and ${l.baffles[j].id} overlap. Adjust their endpoints or define one thicker board.`);
  const mouthAxis=l.mouth.side==='top'||l.mouth.side==='bottom'?1:0,mouthBoundary=l.mouth.side==='top'?h:l.mouth.side==='right'?w:0;
  polygons.forEach((poly,i)=>{const edge=poly.filter(point=>Math.abs(point[mouthAxis]-mouthBoundary)<.01).map(point=>point[1-mouthAxis]);if(edge.length>=2&&Math.min(Math.max(...edge),l.mouth.offset+l.mouth.width/2)-Math.max(Math.min(...edge),l.mouth.offset-l.mouth.width/2)>.1)errors.push(`Baffle ${l.baffles[i].id} obstructs the physical mouth.`);});
  for(let i=0;i<l.baffles.length;i++) {
    const b=l.baffles[i],poly=polygons[i],len=distance(b.start,b.end),angle=Math.atan2(b.end[1]-b.start[1],b.end[0]-b.start[0]);
    const panel=add(b.id,b.label,len,dep,[t+(b.start[0]+b.end[0])/2,t+(b.start[1]+b.end[1])/2,D/2],[Math.PI/2,0,angle]);panel.thickness=b.thickness??t;
    panel.footprint={polygon:poly.map(([x,y])=>[x+t,y+t]),z:t,depth:dep};
    if(Math.abs(Math.sin(2*angle))>.001)panel.notes=['Angled internal board: STEP/STL contains clipped end geometry. DXF/SVG is the stock face outline; fit or machine end mitres from the 3D solid.'];
    if(poly.length<3||polygonArea(poly)<1)errors.push(`Baffle ${b.id} has no material inside the cabinet.`);
  }
  const mounts=(p.mounts?.length?p.mounts:[{id:'primary',driver:p.driver,position:p.design.driverPosition,face:'front' as const,voltageScale:1,phase:0}]).map(m=>{
    const [x,y]=pointOnRoute(l.route,length*1000*m.position);
    const center:[number,number,number]=[x+t,y+t,m.face==='front'?0:D];
    const panel=m.face==='front'?front:back;panel.holes.push({x:center[0]-W/2,y:center[1]-H/2,radius:m.driver.cutout/2});
    if(x<m.driver.frame/2+6-t||x>w-m.driver.frame/2-6+t||y<m.driver.frame/2+6-t||y>h-m.driver.frame/2-6+t)errors.push(`Driver ${m.id} frame overhangs the cabinet or has insufficient edge clearance.`);
    if(dep<m.driver.depth+15)errors.push(`Driver ${m.id} needs more depth for its magnet and 15 mm back clearance.`);
    if(l.baffles.some(b=>pointSegmentDistance([x,y],b.start,b.end)<m.driver.cutout/2+(b.thickness??t)/2+3))errors.push(`Driver ${m.id} cutout intersects an internal baffle.`);
    return {...m,center};
  });
  for(let i=0;i<mounts.length;i++)for(let j=i+1;j<mounts.length;j++)if(mounts[i].face===mounts[j].face&&distance([mounts[i].center[0],mounts[i].center[1]],[mounts[j].center[0],mounts[j].center[1]])<(mounts[i].driver.frame+mounts[j].driver.frame)/2+3)errors.push(`Drivers ${mounts[i].id} and ${mounts[j].id} overlap.`);
  for(let i=0;i<mounts.length;i++)for(let j=i+1;j<mounts.length;j++)if(mounts[i].face!==mounts[j].face&&distance([mounts[i].center[0],mounts[i].center[1]],[mounts[j].center[0],mounts[j].center[1]])<(mounts[i].driver.cutout+mounts[j].driver.cutout)/2&&mounts[i].driver.depth+mounts[j].driver.depth+15>dep)errors.push(`Opposing driver volumes ${mounts[i].id} and ${mounts[j].id} may collide. Increase depth or separate their mounting centres.`);
  if(l.route.length<2||length<.05)errors.push('Wave route needs at least two distinct points and 50 mm total length.');
  if(l.route.length>=2) {
    const mouth=mouthPoint(l,t);if(distance(l.route.at(-1)!,mouth)>1)errors.push('Wave route must end at the centre of the physical mouth.');
    const start=l.route[0];if(Math.min(start[0],start[1],w-start[0],h-start[1])>2)errors.push('Closed end of the route must touch a closed cavity wall.');
    if(distance(start,mouth)<l.mouth.width/2)errors.push('Closed end cannot be in the open mouth.');
    const tests=Math.max(2,Math.ceil(length*1000/3));
    for(let i=1;i<tests;i++){const pt=pointOnRoute(l.route,length*1000*i/tests);if(pt[0]<-.1||pt[0]>w+.1||pt[1]<-.1||pt[1]>h+.1){errors.push('Wave route leaves the cabinet cavity.');break;}if(polygons.some(poly=>insidePolygon(pt,poly))){errors.push('Wave route passes through an internal baffle. Move the baffle or retrace the route.');break;}}
  }
  const sideSpan=l.mouth.side==='left'||l.mouth.side==='right'?h:w;
  if(l.mouth.offset-l.mouth.width/2<0||l.mouth.offset+l.mouth.width/2>sideSpan)errors.push('Mouth extends beyond its cabinet side.');
  const sections=length>0?sampleSections(p):[{distance:0,area:1,width:1,damping:p.design.damping}];
  if(sections.some(s=>s.width<3))errors.push('The route has a blocked or sub-3-mm cross-section.');
  if(!errors.length){
    const key=JSON.stringify([l,t]);let issue=topologyCache.get(key);
    if(issue===undefined){try{const shortest=traceRoute(p,l.route[0],Math.max(5,Math.sqrt(w*h/12000)),0);issue=routeLength(shortest)<length*1000*.7?'The intended route has a much shorter physical bypass. Check unsealed baffle ends or retrace the actual cavity.':null;}catch(error){issue='Cavity routing check failed: '+(error as Error).message;}topologyCache.set(key,issue);if(topologyCache.size>64)topologyCache.delete(topologyCache.keys().next().value!);}
    if(issue)errors.push(issue);
  }
  if(W>p.targets.maxWidth||H>p.targets.maxHeight||D>p.targets.maxDepth)warnings.push('Cabinet exceeds an optimisation size limit.');
  if(l.mouth.side==='bottom')warnings.push('Bottom mouth needs a stand; floor loading is not modelled.');
  if(panels.some(b=>b.notes?.length))warnings.push('Angled baffle ends require 3D machining or mitre fitting; stock DXF outlines do not encode bevel toolpaths.');
  warnings.push('Geometry-derived segmented 1D model: fold scattering, transverse modes, source directivity and structural vibration are not solved.');
  warnings.push('One dominant acoustic route is assumed. Coarse bypass checks do not establish leak-tight joinery or solve side branches; prototype or spatial validation is required.');
  if(mounts.some(v=>v.voltageScale!==mounts[0].voltageScale||v.phase!==mounts[0].phase))warnings.push('Sources have different excitations: the impedance trace refers to the first driven source, not a fictitious common amplifier. Per-driver currents and impedance are included in analysis results.');
  return {width:W,height:H,depth:D,innerHeight:h,innerDepth:dep,lane:Math.min(...sections.map(s=>s.width)),area:sections.reduce((sum,s)=>sum+s.area,0)/sections.length,airVolume:(w*h-polygons.reduce((sum,poly)=>sum+polygonArea(poly),0))*dep/1e6,panels,path:l.route.map(([x,y])=>[x+t,y+t,D/2]),driverCenter:mounts[0]?.center??[t,t,0],errors,warnings,lineLength:length,sections,mounts};
}

/** Clearance-weighted A* through the physical cavity, then line-of-sight simplification. */
export function traceRoute(p:Project,start:XY,cellSize=10,clearanceWeight=100):XY[] {
  if(!p.layout)throw Error('Convert to a custom layout before tracing.');
  const l=p.layout,t=p.design.thickness,w=l.width-2*t,h=l.height-2*t,end=mouthPoint(l,t),polys=l.baffles.map(b=>bafflePolygon(b,t,w,h));
  const nx=Math.ceil(w/cellSize),ny=Math.ceil(h/cellSize);if(nx*ny>120000)throw Error('Grid exceeds 120,000 cells. Increase cellSize.');
  const point=(i:number):XY=>[(i%nx+.5)*w/nx,(Math.floor(i/nx)+.5)*h/ny];
  const cell=(pt:XY)=>Math.min(ny-1,Math.max(0,Math.floor(pt[1]/h*ny)))*nx+Math.min(nx-1,Math.max(0,Math.floor(pt[0]/w*nx)));
  const blocked=Uint8Array.from({length:nx*ny},(_,i)=>polys.some(poly=>insidePolygon(point(i),poly))?1:0);
  const s=cell(start),goal=cell(end);if(blocked[s]||blocked[goal])throw Error('Start or mouth is inside a baffle.');
  const clearance=new Float64Array(nx*ny);
  for(let i=0;i<clearance.length;i++){const pt=point(i);clearance[i]=Math.min(pt[0],pt[1],w-pt[0],h-pt[1],...l.baffles.map(b=>Math.max(0,pointSegmentDistance(pt,b.start,b.end)-(b.thickness??t)/2)));}
  const costs=new Float64Array(nx*ny).fill(Infinity),prev=new Int32Array(nx*ny).fill(-1),closed=new Uint8Array(nx*ny),heap:{i:number;score:number}[]=[];
  const push=(i:number,score:number)=>{heap.push({i,score});let k=heap.length-1;while(k>0){const parent=(k-1)>>1;if(heap[parent].score<=score)break;[heap[k],heap[parent]]=[heap[parent],heap[k]];k=parent;}};
  const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let k=0;for(;;){let next=k,left=2*k+1,right=left+1;if(left<heap.length&&heap[left].score<heap[next].score)next=left;if(right<heap.length&&heap[right].score<heap[next].score)next=right;if(next===k)break;[heap[k],heap[next]]=[heap[next],heap[k]];k=next;}}return first;};
  costs[s]=0;push(s,0);
  while(heap.length){const {i}=pop();if(closed[i])continue;if(i===goal)break;closed[i]=1;const x=i%nx,y=Math.floor(i/nx);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=nx||yy>=ny)continue;const j=yy*nx+xx;if(blocked[j]||closed[j]||(dx&&dy&&(blocked[y*nx+xx]||blocked[yy*nx+x])))continue;const cost=costs[i]+distance(point(i),point(j))*(1+clearanceWeight/Math.max(4,clearance[j]**2));if(cost<costs[j]){costs[j]=cost;prev[j]=i;push(j,cost+distance(point(j),end));}}
  }
  if(!Number.isFinite(costs[goal]))throw Error('No open route reaches the mouth. A baffle seals the cavity.');
  const raw:XY[]=[];for(let i=goal;i!==-1;i=prev[i])raw.push(point(i));raw.reverse();raw[0]=start;raw[raw.length-1]=end;
  const clear=(a:XY,b:XY)=>{const count=Math.ceil(distance(a,b)/Math.max(1,cellSize/3));for(let i=1;i<count;i++){const r=i/count,pt:XY=[a[0]+(b[0]-a[0])*r,a[1]+(b[1]-a[1])*r];if(polys.some(poly=>insidePolygon(pt,poly))||l.baffles.some(q=>pointSegmentDistance(pt,q.start,q.end)<(q.thickness??t)/2+Math.min(5,cellSize/2)))return false;}return true;};
  const result:XY[]=[raw[0]];let at=0;while(at<raw.length-1){let next=Math.min(raw.length-1,at+1);for(let j=next+1;j<raw.length;j++){if(raw.slice(at,j+1).every(pt=>pointSegmentDistance(pt,raw[at],raw[j])<=cellSize*.6)&&clear(raw[at],raw[j]))next=j;else break;}result.push(raw[next]);at=next;}
  return result;
}
