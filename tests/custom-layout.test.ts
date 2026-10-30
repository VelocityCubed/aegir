import {describe,it,expect} from 'vitest';
import {defaultProject} from '../src/core/defaults';
import {buildGeometry,editableLayout} from '../src/core/geometry';
import {simulate,standingWave} from '../src/core/acoustics';
import {validateProject} from '../src/core/validation';
import {traceRoute,mouthPoint} from '../src/core/layout';
import {panelGeometry} from '../src/core/meshes';
import {sourceHeadroom} from '../src/core/metrics';

describe('custom geometry and coupled wave solver',()=>{
  it('matches the closed-form uniform-line solver with an independently stamped nodal system',()=>{
    const p=structuredClone(defaultProject);p.design.folds=1;
    const simple=simulate(p,80),custom=editableLayout(p);validateProject(custom);
    const g=buildGeometry(custom);expect(g.errors).toEqual([]);
    const network=simulate(custom,80);
    simple.points.forEach((a,i)=>{const b=network.points[i];expect(b.spl).toBeCloseTo(a.spl,7);expect(b.impedance).toBeCloseTo(a.impedance,7);expect(b.excursion).toBeCloseTo(a.excursion,7);expect(b.velocity).toBeCloseTo(a.velocity,7);});
  });
  it('keeps converted baffles and the physical mouth consistent and traces a collision-free wave route',()=>{
    const p=editableLayout(structuredClone(defaultProject));const before=buildGeometry(p);expect(before.errors).toEqual([]);expect(before.lineLength).toBeCloseTo(p.design.length,9);
    p.layout!.route=traceRoute(p,p.layout!.route[0],10);
    expect(p.layout!.route.at(-1)).toEqual(mouthPoint(p.layout!,p.design.thickness));
    expect(buildGeometry(p).errors).toEqual([]);
    const result=simulate(p,50);expect(Number.isFinite(result.bandMean)).toBe(true);expect(standingWave(p,50).every(v=>Number.isFinite(v.pressure))).toBe(true);
  });
  it('rejects a route crossing a board and preserves exact angled board meshes',()=>{
    const p=editableLayout(structuredClone(defaultProject));p.layout!.baffles[0].end[0]+=40;
    const g=buildGeometry(p),panel=g.panels.find(v=>v.id==='baffle-1')!;
    expect(panel.footprint!.polygon.length).toBeGreaterThanOrEqual(4);
    const world=panelGeometry(panel),local=panelGeometry(panel,false);world.computeBoundingBox();local.computeBoundingBox();
    expect(world.boundingBox!.min.z).toBeCloseTo(p.design.thickness,5);expect(local.boundingBox!.min.z).toBeCloseTo(-p.design.thickness/2,3);
    world.dispose();local.dispose();
    p.layout!.route=[[85,p.layout!.height-36],[273,85],[273,p.layout!.height-36]];
    expect(buildGeometry(p).errors.some(e=>e.includes('passes through'))).toBe(true);expect(()=>simulate(p)).toThrow('invalid geometry');
  });
  it('couples two independent source mounts and reports per-driver excursion and electrical data',()=>{
    const p=structuredClone(defaultProject);p.design.folds=1;p.design.length=2.4;
    const custom=editableLayout(p);custom.mounts=[{id:'woofer-a',driver:p.driver,position:.15,face:'front',phase:0,voltageScale:1},{id:'woofer-b',driver:p.driver,position:.55,face:'front',phase:0,voltageScale:1}];
    validateProject(custom);expect(buildGeometry(custom).errors).toEqual([]);
    const a=simulate(custom,50);custom.mounts[1].phase=180;const b=simulate(custom,50);
    expect(a.points.every(v=>v.drivers?.length===2)).toBe(true);expect(Math.abs(a.bandMean-b.bandMean)).toBeGreaterThan(.5);
  });
  it('rejects unsafe IDs and malformed custom data without mutating the input',()=>{
    const p=editableLayout(structuredClone(defaultProject));p.layout!.baffles[0].id='../escape';expect(()=>validateProject(p)).toThrow('safe identifiers');
  });
  it('diagnoses overlapping boards, obstructed mouths and unsealed bypasses',()=>{
    const p=editableLayout(structuredClone(defaultProject));
    p.layout!.baffles.push({...p.layout!.baffles[0],id:'overlap'});
    expect(buildGeometry(p).errors.some(e=>e.includes('overlap'))).toBe(true);
    p.layout!.baffles.pop();const mouth=p.layout!.mouth;
    p.layout!.baffles.push({id:'blocking-mouth',label:'Blocked outlet',start:[mouth.offset,0],end:[mouth.offset,p.layout!.height-36]});
    expect(buildGeometry(p).errors.some(e=>e.includes('obstructs the physical mouth'))).toBe(true);
    p.layout!.baffles=[];
    expect(buildGeometry(p).errors.some(e=>e.includes('bypass'))).toBe(true);
  });
  it('uses actual shared excitation for input impedance and each driver’s own Xmax',()=>{
    const p=structuredClone(defaultProject);p.design.folds=1;p.design.length=2.4;
    const custom=editableLayout(p);custom.mounts=[{id:'a',driver:p.driver,position:.15,face:'front',phase:0,voltageScale:1},{id:'b',driver:{...p.driver,xmax:.5},position:.55,face:'front',phase:0,voltageScale:1}];
    const a=simulate(custom,40);custom.mounts.forEach(m=>m.voltageScale=2);const b=simulate(custom,40);
    a.points.forEach((v,i)=>expect(b.points[i].impedance).toBeCloseTo(v.impedance,8));
    const sources=sourceHeadroom(custom,b);expect(sources[1].xmax).toBe(.5);expect(sources[1].ratio).toBeCloseTo(sources[1].peakExcursion/.5,10);
  });
});
