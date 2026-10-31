import * as THREE from 'three';
import type { Panel } from './types';
export function panelShape(p:Panel) {
  const s=new THREE.Shape(),w=p.width/2,h=p.height/2;
  if(p.outline?.length){p.outline.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();}
  else{s.moveTo(-w,-h);s.lineTo(w,-h);s.lineTo(w,h);s.lineTo(-w,h);s.closePath();}
  for(const hole of p.holes) {const path=new THREE.Path();path.absarc(hole.x,hole.y,hole.radius,0,Math.PI*2,true);s.holes.push(path);}
  for(const o of p.openings??[]){const path=new THREE.Path(),x=o.x-o.width/2,y=o.y-o.height/2;path.moveTo(x,y);path.lineTo(x,y+o.height);path.lineTo(x+o.width,y+o.height);path.lineTo(x+o.width,y);path.closePath();s.holes.push(path);}
  return s;
}
export function panelGeometry(p:Panel,world=true) {
  if(p.footprint){
    const shape=new THREE.Shape();p.footprint.polygon.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:p.footprint.depth,bevelEnabled:false});geometry.translate(0,0,p.footprint.z);
    if(!world){const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...p.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rotation,'ZYX')),new THREE.Vector3(1,1,1));geometry.applyMatrix4(matrix.invert());}
    return geometry;
  }
  const g=new THREE.ExtrudeGeometry(panelShape(p),{depth:p.thickness,bevelEnabled:false,curveSegments:64});
  g.translate(0,0,-p.thickness/2);
  if(world) {
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...p.rotation,'ZYX')));
    g.translate(...p.position);
  }
  return g;
}
