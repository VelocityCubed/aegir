import { describe,it,expect } from 'vitest';
import { defaultProject } from '../src/core/defaults';
import { simulate,driverModel,lineMatrix,standingWave,radiation } from '../src/core/acoustics';
import { buildGeometry } from '../src/core/geometry';
import { add,mul,sub,abs,div } from '../src/core/complex';
import { optimize,scoreProject } from '../src/core/optimizer';
import { validateProject } from '../src/core/validation';
import { makeBundle,dxf,panelSvg } from '../src/core/exports';
import { panelGeometry } from '../src/core/meshes';
import { unzipSync,strFromU8 } from 'fflate';
import * as THREE from 'three';
import { writeFileSync,mkdirSync } from 'node:fs';
const project=()=>structuredClone(defaultProject);
describe('acoustic physics',()=>{
  it('recovers Fs and Qes from derived electromechanical parameters',()=>{
    const p=project(),m=driverModel(p),w=2*Math.PI*p.driver.fs;
    expect(1/(2*Math.PI*Math.sqrt(m.mms*m.cms))).toBeCloseTo(p.driver.fs,9);
    expect(w*m.mms*p.driver.re/(m.bl*m.bl)).toBeCloseTo(p.driver.qes,9);
    expect(w*m.mms/m.rms).toBeCloseTo(p.driver.qms,9);
  });
  it('matches the analytic lossless open and closed tube solutions',()=>{
    const area=.03,c=343,rho=1.2,f=43,length=1.7,k=2*Math.PI*f/c,z=rho*c/area;
    const mat=lineMatrix(f,length,area,c,rho,0);
    const open=div(mat.b,mat.d),closed=div(mat.a,mat.c);
    expect(open[0]).toBeCloseTo(0,7);expect(open[1]).toBeCloseTo(z*Math.tan(k*length),7);
    expect(closed[0]).toBeCloseTo(0,7);expect(closed[1]).toBeCloseTo(-z/Math.tan(k*length),7);
  });
  it('recovers measured free-air resonance and mechanical Q without double-counting radiation',()=>{
    const p=project(),m=driverModel(p),omega=2*Math.PI*p.driver.fs,rad=radiation(p.driver.fs,m.sd,m.c,m.rho);
    const resistance=m.rmd+2*m.sd*m.sd*rad[0],reactance=omega*m.mmd-1/(omega*m.cms)+2*m.sd*m.sd*rad[1];
    expect(reactance).toBeCloseTo(0,10);expect(resistance).toBeCloseTo(m.rms,10);
    expect(omega*m.mms/resistance).toBeCloseTo(p.driver.qms,10);
  });
  it('keeps band metrics finite even for a narrow target interval',()=>{
    const p=project();p.targets.low=59.99;p.targets.high=60.01;validateProject(p);
    const s=simulate(p);expect(Number.isFinite(s.bandMean)).toBe(true);expect(Number.isFinite(s.ripple)).toBe(true);
  });
  it('preserves reciprocal determinant and composition of acoustic segments',()=>{
    const args=[.032,343,1.2,.6] as const,a=lineMatrix(67,.4,...args),b=lineMatrix(67,.9,...args),whole=lineMatrix(67,1.3,...args);
    expect(abs(sub(sub(mul(a.a,a.d),mul(a.b,a.c)),[1,0]))).toBeLessThan(1e-10);
    expect(abs(sub(add(mul(a.a,b.a),mul(a.b,b.c)),whole.a))).toBeLessThan(1e-10);
    expect(abs(sub(add(mul(a.a,b.b),mul(a.b,b.d)),whole.b))).toBeLessThan(1e-8);
  });
  it('obeys small-signal voltage scaling and includes complex interference',()=>{
    const p=project(),a=simulate(p);p.design.voltage*=2;const b=simulate(p);
    a.points.forEach((pt,i)=>{
      expect(b.points[i].spl-pt.spl).toBeCloseTo(20*Math.log10(2),9);
      expect(b.points[i].excursion).toBeCloseTo(pt.excursion*2,9);
      expect(b.points[i].impedance).toBeCloseTo(pt.impedance,9);
      expect(Object.values(pt).every(Number.isFinite)).toBe(true);
    });
    expect(a.points.some(pt=>pt.spl<Math.max(pt.coneSpl,pt.terminusSpl))).toBe(true);
  });
  it('shows driver-dependent loading and normalized wave pressure',()=>{
    const p=project(),a=simulate(p);p.driver.qes=.7;p.driver.fs=47;
    const b=simulate(p);expect(Math.abs(a.bandMean-b.bandMean)).toBeGreaterThan(.1);
    const values=standingWave(p,50);expect(Math.max(...values.map(v=>v.pressure))).toBeCloseTo(1,10);
    expect(values.every(v=>Number.isFinite(v.pressure)&&v.pressure>=0)).toBe(true);
  });
});
describe('geometry and fabrication',()=>{
  it.each([1,2,3,4])('matches the requested path length and clear volume for %i passes',folds=>{
    const p=project();p.design.folds=folds;p.design.length=3;p.design.driverPosition=.08;
    const g=buildGeometry(p);
    const length=g.path.slice(1).reduce((sum,v,i)=>sum+new THREE.Vector3(...v).distanceTo(new THREE.Vector3(...g.path[i])),0);
    expect(length).toBeCloseTo(p.design.length*1000,7);
    expect(g.airVolume).toBeCloseTo(g.area*p.design.length/1000,7);
    expect(g.path.at(-1)![1]).toBeCloseTo(folds%2===0?g.height-p.design.thickness:p.design.thickness,8);
  });
  it('rejects driver/turn collisions and prevents fabrication export',()=>{
    const p=project();expect(buildGeometry(p).errors).toEqual([]);p.design.driverPosition=.39;
    expect(buildGeometry(p).errors.some(e=>e.includes('turn'))).toBe(true);
    expect(()=>makeBundle(p,simulate(p))).toThrow('Resolve geometry');
  });
  it('makes closed individual panel meshes with the expected material volume',()=>{
    const g=buildGeometry(project());
    for(const p of g.panels) {
      const mesh=panelGeometry(p,false),pos=mesh.getAttribute('position');let vol=0;const edges=new Map<string,number>();
      for(let i=0;i<pos.count;i+=3) {
        const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);
        vol+=a.dot(b.clone().cross(c))/6;
        const vertices=[a,b,c].map(v=>v.toArray().map(n=>n.toFixed(3)).join(','));
        for(let j=0;j<3;j++){const edge=[vertices[j],vertices[(j+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}
      }
      const analytic=(p.width*p.height-p.holes.reduce((sum,h)=>sum+Math.PI*h.radius**2,0))*p.thickness;
      expect(Math.abs(vol)/analytic).toBeCloseTo(1,3);
      expect([...edges.values()].every(n=>n===2)).toBe(true);mesh.dispose();
    }
  });
  it('exports reproducible metric CAD files, cuts, data, and project in a readable ZIP',()=>{
    const p=project(),s=simulate(p),bundle=makeBundle(p,s),files=unzipSync(bundle),g=buildGeometry(p);
    expect(JSON.parse(strFromU8(files['project.aegir.json']))).toEqual(p);
    expect(strFromU8(files['cut-list.csv']).split('\n').length).toBe(g.panels.length+2);
    expect(strFromU8(files['response.csv']).split('\n').length).toBe(s.points.length+1);
    expect(dxf(g.panels[0])).toContain('$INSUNITS\n70\n4');
    expect(panelSvg(g.panels[0])).toContain('mm');
    for(const panel of g.panels){expect(files[`panels/${panel.id}.stl`].length).toBeGreaterThan(100);expect(files[`panels/${panel.id}.dxf`]).toBeDefined();}
    mkdirSync('test-results',{recursive:true});writeFileSync('test-results/example-build.zip',bundle);writeFileSync('test-results/project.json',JSON.stringify(p));writeFileSync('test-results/panels.json',JSON.stringify(g.panels));
    writeFileSync('test-results/enclosure.py',strFromU8(files['enclosure.py']));
  });
});
describe('input and optimiser constraints',()=>{
  it('rejects missing, nonfinite, out-of-range, inconsistent and fractional-pass inputs',()=>{
    expect(()=>validateProject(project())).not.toThrow();
    for(const value of [null,{}, {...project(),version:2},{...project(),design:{...project().design,length:NaN}},{...project(),design:{...project().design,folds:2.5}},{...project(),targets:{...project().targets,low:100,high:80}}])expect(()=>validateProject(value)).toThrow();
  });
  it('returns reproducible feasible candidates that improve or match the initial score',async()=>{
    const p=project(),baseline=scoreProject(p)!;
    const a=await optimize(p,()=>{}),b=await optimize(p,()=>{});
    expect(a.length).toBeGreaterThan(0);expect(a.map(c=>c.score)).toEqual(b.map(c=>c.score));expect(a[0].score).toBeLessThanOrEqual(baseline.score);
    for(const c of a){validateProject(c.project);expect(c.geometry.errors).toEqual([]);expect(c.geometry.height).toBeLessThanOrEqual(p.targets.maxHeight);expect(c.geometry.width).toBeLessThanOrEqual(p.targets.maxWidth);expect(c.geometry.depth).toBeLessThanOrEqual(p.targets.maxDepth);}
  },20000);
  it('returns no result for an infeasible brief and supports cancellation',async()=>{
    const p=project();p.targets.maxWidth=100;expect(await optimize(p,()=>{})).toEqual([]);
    let cancelled=false;await optimize(project(),()=>{cancelled=true;},()=>cancelled);expect(cancelled).toBe(true);
  });
});
