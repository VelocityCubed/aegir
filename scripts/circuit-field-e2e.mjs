import {_electron as electron} from 'playwright';
import electronPath from 'electron';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const {circuitFromProject}=createRequire(import.meta.url)('../engine/service.cjs');
const out=resolve(process.env.AEGIR_TEST_OUT??'test-results/circuit-field'),profile=await mkdtemp(join(tmpdir(),'aegir-circuit-field-'));await mkdir(out,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.WAVELAB_DEV;
const app=await electron.launch({executablePath:process.env.AEGIR_TEST_APP??electronPath,args:[...(process.env.AEGIR_TEST_APP?[]:[resolve('.')]),'--user-data-dir='+profile],env,timeout:45000}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WGSL|WebGPU/.test(m.text()))errors.push(m.text());});
const call=(name,args={})=>page.evaluate(c=>window.desktop.command(c),{name,args});
async function complete(id){for(let i=0;i<1200;i++){const j=await call('job.get',{id,includeResult:true});if(j.status!=='running'){assert.equal(j.status,'completed',j.error);return j;}await new Promise(r=>setTimeout(r,100));}throw Error('Field job timeout');}
try{
  await page.getByRole('navigation',{name:'Design workflow'}).waitFor();
  const p=JSON.parse(await readFile('research/tapered-fold.aegir.json','utf8'));
  delete p.system; p.design.damping=0; p.driver.lossyInductance={resistance:.8,inductance:.7};p.mounts[0].driver=structuredClone(p.driver);
  p.mounts[0].crossover={passive:[{connection:'series',kind:'L',value:.0012,resistance:.4},{connection:'shunt',kind:'C',value:10e-6,resistance:.1}],active:[{kind:'highpass',frequency:60,order:2}]};
  p.mounts[1].rearLoading='sealed-back';p.mounts[1].driver={...p.mounts[1].driver,name:'Synthetic circuit secondary',cutout:116,frame:140,depth:60,sd:80,fs:55,qes:.55,lossyInductance:{resistance:.5,inductance:.4}};
  p.mounts[1].crossover={passive:[{connection:'series',kind:'C',value:15e-6,resistance:.2},{connection:'shunt',kind:'L',value:.0005,resistance:.3}]};
  p.circuit=circuitFromProject(p);p.mounts.forEach(m=>delete m.crossover);
  await call('project.replace',{project:p,requireValidGeometry:true});
  const settings={cellMm:30,paddingMm:300,durationMs:8,frequency:500,frames:24,signal:'burst',axis:'xy',slice:.5,attenuation:0,volume:true};
  const cpuJob=await complete((await call('field.run',{settings:{...settings,backend:'cpu'}})).id),cpu=await call('field.result',{id:cpuJob.id,frame:18,traces:true});
  assert.equal(cpu.meta.electrical.scheme,'implicit-midpoint-MNA');assert.equal(cpu.meta.project.circuit.parts.length,p.circuit.parts.length);
  const capabilities=await call('field.capabilities');assert.equal(capabilities.gpu.webgpu,true,'This acceptance run requires a real WebGPU device');
  const gpuJob=await complete((await call('field.run',{settings:{...settings,backend:'webgpu'}})).id),gpu=await call('field.result',{id:gpuJob.id,frame:18,traces:true});
  let difference=0,denominator=0;for(let i=0;i<cpu.frame.data.length;i++){difference+=(cpu.frame.data[i]-gpu.frame.data[i])**2;denominator+=cpu.frame.data[i]**2;}const relative=Math.sqrt(difference/Math.max(1e-30,denominator));assert(relative<2e-4,`Circuit CPU/GPU error ${relative}`);
  p.system={sweep:[15,800],distanceM:1,physics:{ductLoss:'mjk-2003',radiation:'piston',stuffing:[{start:0,end:.65,source:'Synthetic steady-media test, assumed fibre parameters',calibration:'assumed',material:{model:'mjk-2003',densityKgM3:4}}]}};
  await call('project.replace',{project:p,requireValidGeometry:true});
  const steady={...settings,signal:'steady',durationMs:60,frequency:400,frames:128};
  const scJob=await complete((await call('field.run',{settings:{...steady,backend:'cpu'}})).id),sc=await call('field.result',{id:scJob.id,frame:110});
  const sgJob=await complete((await call('field.run',{settings:{...steady,backend:'webgpu'}})).id),sg=await call('field.result',{id:sgJob.id,frame:110});
  let se=0,sr=0;for(let i=0;i<sc.frame.data.length;i++){se+=(sc.frame.data[i]-sg.frame.data[i])**2;sr+=sc.frame.data[i]**2;}const steadyError=Math.sqrt(se/Math.max(sr,1e-30));assert(steadyError<3e-4,'Steady media parity '+steadyError);assert.equal(sc.meta.medium.frequency,400);assert(sc.meta.medium.regionCells[0]>0);assert(sc.meta.steadyState.relativeChange<.01,JSON.stringify(sc.meta.steadyState));assert.deepEqual((await call('workspace.get')).project,p);
  assert.deepEqual((await call('workspace.get')).project,p);
  await page.locator('.field-workbench[data-field-state="ready"]').waitFor();await page.screenshot({path:join(out,'coupled-circuit.png'),fullPage:true});assert.deepEqual(errors,[]);
  await writeFile(join(out,'verification.json'),JSON.stringify({relativePressureError:relative,steadyMediaPressureError:steadyError,steadyState:sc.meta.steadyState,circuitParts:p.circuit.parts.length,states:cpu.meta.electrical.states,sourceProjectUnchanged:true,CPU:cpu.meta.backend,GPU:gpu.meta.backend,errors},null,2));
  console.log('Coupled circuit CPU/GPU field passed. Relative pressure error: '+relative);
}catch(e){await page.screenshot({path:join(out,'failure.png'),fullPage:true});throw e;}finally{await app.close();}
