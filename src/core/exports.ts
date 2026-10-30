import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { zipSync,strToU8 } from 'fflate';
import type { Panel,Project,Simulation } from './types';
import { buildGeometry } from './geometry';
import { panelGeometry } from './meshes';
export const safeName=(s:string)=>s.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80)||'enclosure';
export const xml=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
const num=(v:number)=>Number(v.toFixed(5));
export function dxf(p:Panel) {
  const lines:(string|number)[]=[0,'SECTION',2,'HEADER',9,'$INSUNITS',70,4,0,'ENDSEC',0,'SECTION',2,'ENTITIES'];
  // AC1009-compatible POLYLINE, closed, in mm. Origin lower left.
  lines.push(0,'POLYLINE',8,'CUT',66,1,70,1);
  for(const [x,y] of [[0,0],[p.width,0],[p.width,p.height],[0,p.height]]) lines.push(0,'VERTEX',8,'CUT',10,num(x),20,num(y),30,0);
  lines.push(0,'SEQEND');
  for(const h of p.holes) lines.push(0,'CIRCLE',8,'CUT',10,num(h.x+p.width/2),20,num(h.y+p.height/2),30,0,40,num(h.radius));
  lines.push(0,'ENDSEC',0,'EOF');return lines.join('\n')+'\n';
}
export function panelSvg(p:Panel) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}mm" height="${p.height}mm" viewBox="0 0 ${p.width} ${p.height}"><g fill="none" stroke="black" stroke-width="0.1"><rect x="0" y="0" width="${p.width}" height="${p.height}"/>${p.holes.map(h=>`<circle cx="${h.x+p.width/2}" cy="${p.height/2-h.y}" r="${h.radius}"/>`).join('')}</g></svg>`;
}
export function cutList(project:Project) {
  const quote=(v:string)=>'"'+(/^[=+@-]/.test(v)?"'":'')+v.replaceAll('"','""')+'"';
  return 'part,width_mm,height_mm,thickness_mm,quantity\n'+buildGeometry(project).panels.map(p=>`${quote(p.label)},${num(p.width)},${num(p.height)},${p.thickness},1`).join('\n')+'\n';
}
export function responseCsv(s:Simulation) {
  return 'frequency_hz,total_spl_db,cone_spl_db,terminus_spl_db,impedance_ohm,impedance_phase_deg,excursion_peak_mm,terminus_velocity_peak_m_s,group_delay_ms\n'+s.points.map(p=>[p.frequency,p.spl,p.coneSpl,p.terminusSpl,p.impedance,p.impedancePhase,p.excursion,p.velocity,p.groupDelay].map(num).join(',')).join('\n');
}
export function openScad(p:Project) {
  const g=buildGeometry(p);
  return `// ÆONFORGE ÆGIR | millimetres | export each panel separately for fabrication\n// Line centreline ${g.lineLength} m; ${p.design.damping} Np/m loss at 100 Hz\n$fn=128;\n`+g.panels.map(panel=>panel.footprint?`// ${panel.label.replace(/[\r\n]/g,' ')}\ntranslate([0,0,${panel.footprint.z}]) linear_extrude(height=${panel.footprint.depth}) polygon(points=${JSON.stringify(panel.footprint.polygon)});\n`:`// ${panel.label.replace(/[\r\n]/g,' ')}\ntranslate([${panel.position.map(num)}]) rotate([${panel.rotation.map(v=>num(v*180/Math.PI))}]) difference(){\n cube([${num(panel.width)},${num(panel.height)},${panel.thickness}],center=true);\n${panel.holes.map(h=>` translate([${num(h.x)},${num(h.y)},0]) cylinder(h=${panel.thickness+2},r=${h.radius},center=true);`).join('\n')}\n}\n`).join('\n');
}
export function cadQueryScript(p:Project) {
  // Numeric geometry plus escaped strings are encoded as data, never Python source.
  const json=JSON.stringify(buildGeometry(p).panels);
  const escaped=JSON.stringify(json);
  return `"""ÆGIR exact panel assembly. Units: mm. Run python enclosure.py [output-directory]."""
import json, math, pathlib, sys
import cadquery as cq
panels = json.loads(${escaped})
out = pathlib.Path(sys.argv[1] if len(sys.argv)>1 else "cad-output")
out.mkdir(parents=True, exist_ok=True)
assembly = cq.Assembly(name="Aegir_Enclosure")
for p in panels:
    if p.get("footprint"):
        f=p["footprint"]
        part=cq.Workplane("XY").polyline(f["polygon"]).close().extrude(f["depth"]).translate((0,0,f["z"]))
        local=part.translate(tuple(-v for v in p["position"]))
        for axis,angle in reversed(list(zip([(1,0,0),(0,1,0),(0,0,1)],p["rotation"]))):
            if angle: local=local.rotate((0,0,0),axis,-math.degrees(angle))
    else:
        part=cq.Workplane("XY").box(p["width"],p["height"],p["thickness"])
        for hole in p["holes"]:
            part=part.cut(cq.Workplane("XY").center(hole["x"],hole["y"]).circle(hole["radius"]).extrude(p["thickness"]+2,both=True))
        local=part
        for axis,angle in zip([(1,0,0),(0,1,0),(0,0,1)],p["rotation"]):
            if angle: part=part.rotate((0,0,0),axis,math.degrees(angle))
        part=part.translate(tuple(p["position"]))
    cq.exporters.export(local,str(out/(p["id"]+".stl")))
    assembly.add(part,name=p["id"],color=cq.Color(0.72,0.53,0.32))
assembly.export(str(out/"enclosure.step"))
print(str(out/"enclosure.step"))
`;
}
export function makeBundle(p:Project,s:Simulation) {
  const g=buildGeometry(p);
  if(g.errors.length) throw Error('Resolve geometry errors before exporting: '+g.errors.join(' '));
  const files:Record<string,Uint8Array>={};
  const text=(path:string,data:string)=>files[path]=strToU8(data);
  text('project.aegir.json',JSON.stringify(p,null,2));text('geometry-manifest.json',JSON.stringify({project:p,panels:g.panels},null,2));text('cut-list.csv',cutList(p));text('response.csv',responseCsv(s));
  text('enclosure.scad',openScad(p));text('enclosure.py',cadQueryScript(p));
  const exporter=new STLExporter(),group=new THREE.Group();
  for(const panel of g.panels) {
    text(`panels/${panel.id}.dxf`,dxf(panel));text(`panels/${panel.id}.svg`,panelSvg(panel));
    const local=panelGeometry(panel,false),mesh=new THREE.Mesh(local);
    const stl=exporter.parse(mesh,{binary:true});files[`panels/${panel.id}.stl`]=new Uint8Array(stl.buffer,stl.byteOffset,stl.byteLength).slice();local.dispose();
    group.add(new THREE.Mesh(panelGeometry(panel)));
  }
  const full=exporter.parse(group,{binary:true});files['assembly-reference.stl']=new Uint8Array(full.buffer,full.byteOffset,full.byteLength).slice();
  group.children.forEach(child=>(child as THREE.Mesh).geometry.dispose());
  const routeNotes=p.layout?`Custom cabinet. Mouth exits ${p.layout.mouth.side}, centre offset ${p.layout.mouth.offset} mm, clear width ${p.layout.mouth.width} mm. Wave route points and internal baffles are in project.aegir.json; exact panel solids are in geometry-manifest.json. Keep the actual mouth open.\n`:`Generated uniform cabinet with ${p.design.folds} passes. Clear turn height ${g.lane.toFixed(2)} mm. Mouth is ${p.design.folds%2===0?'top':'bottom'}; keep it open.\n`;
  text('BUILD-NOTES.txt',`Custom layout: ${p.layout?'yes':'no'}. Actual route length: ${g.lineLength.toFixed(4)} m.\nPanel-specific machining notes:\n${g.panels.flatMap(panel=>(panel.notes??[]).map(note=>panel.id+': '+note)).join('\n')}\n\nÆONFORGE ÆGIR — ${p.name}\nAll geometry units: mm. STL has no unit metadata; import as mm.\n\n${routeNotes}One enclosure, ${g.panels.length} panels. Front/back overlap the sides. Caps and internal boards fit between front/back. Driver source cutouts follow the actual mounting centres. Verify mounting screws, basket, recess and magnet against your physical driver.\nThe 3D driver is a visual placeholder and is not part of fabrication exports.\n\nDXF/SVG files are 1:1 individual panel cutting outlines. No kerf, tool-radius offsets, nesting, tabs, screw holes or pockets are applied. Use your CAM software for toolpaths.\nAssembly STL is a reference assembly of touching panel shells. Use individual panel STL files for separate manufacturing.\nRun python enclosure.py to make a B-rep STEP assembly with CadQuery. The app can also generate STEP if the optional CAD backend is installed.\n\nSmall-signal linear 1D model; ${p.design.voltage} V RMS, 1 m, ideal half-space co-located cone/mouth. Damping ${p.design.damping} Np/m at 100 Hz, alpha proportional to sqrt(f/100). No material calibration or slowed sound speed.\nNo fold losses, diffraction, room, crossover, thermal compression, structural modes or nonlinear distortion. Driver displacement and bracing are not subtracted. Lossless sound speed from temperature.\nPredictions have analytic regression checks, but no independent physical validation. Prototype and measure before committing to a final build.\n\nWarnings:\n${g.warnings.join('\n')}\n`);
  return zipSync(files,{level:6});
}
export function download(data:string|Uint8Array,name:string,type='application/octet-stream') {
  const payload=typeof data==='string'?data:new Uint8Array(data).buffer;
  const url=URL.createObjectURL(new Blob([payload],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
