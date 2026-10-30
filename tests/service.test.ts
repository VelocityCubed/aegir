import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile,writeFile,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DesignService} from '../src/agent/service';

const setup=async()=>new DesignService({directory:await mkdtemp(path.join(tmpdir(),'aegir-service-')),workerPath:path.resolve('engine/worker.cjs')}).initialize();
async function done(service:DesignService,id:string){for(let i=0;i<500;i++){const job=await service.dispatch({name:'job.get',args:{id,includeResult:true}});if(job.status!=='running')return job;await new Promise(r=>setTimeout(r,20));}throw Error('Job timeout');}
describe('canonical agent workspace',()=>{
  it('migrates pre-field view state without changing the project',async()=>{
    const service=await setup(),legacy=structuredClone(service.state);delete (legacy.view as any).field;await writeFile(path.join(service.options.directory,'workspace.json'),JSON.stringify(legacy));
    const restored=await new DesignService(service.options).initialize();expect(restored.state.project).toEqual(service.state.project);expect(restored.state.view.field).toMatchObject({jobId:null,frame:0,playing:false,showDrivers:true,driverMotionScale:50});await restored.close();
    const oldFieldView=structuredClone(service.state);delete (oldFieldView.view.field as any).showDrivers;delete (oldFieldView.view.field as any).driverMotionScale;oldFieldView.view.field.fps=12;await writeFile(path.join(service.options.directory,'workspace.json'),JSON.stringify(oldFieldView));const migratedField=await new DesignService(service.options).initialize();expect(migratedField.state.view.field).toMatchObject({fps:12,showDrivers:true,driverMotionScale:50});await migratedField.close();await service.close();
  });
  it('persists spatial recordings with their source revision and merges field view patches',async()=>{
    const service=await setup(),source=structuredClone(service.state.project),job=await service.dispatch({name:'field.run',args:{settings:{cellMm:30,paddingMm:300,durationMs:8,frames:12,backend:'cpu'}}});
    await service.dispatch({name:'project.patch',args:{name:'Edited while solving'}});const result=await done(service,job.id);expect(result.status).toBe('completed');expect(result.result.artifact.projectRevision).toBe(0);
    await service.dispatch({name:'field.open',args:{id:job.id}});await service.dispatch({name:'view.set',args:{field:{driverMotionScale:100,showDrivers:false}}});await service.dispatch({name:'view.set',args:{field:{frame:2}}});expect(service.state.view.field.jobId).toBe(job.id);expect(service.state.view.field.driverMotionScale).toBe(100);expect(service.state.view.field.showDrivers).toBe(false);await service.dispatch({name:'view.set',args:{field:{frame:2.5}}});expect(service.state.view.field.frame).toBe(2.5);await expect(service.dispatch({name:'view.set',args:{field:{frame:11.5}}})).rejects.toMatchObject({code:'FRAME_RANGE'});await service.dispatch({name:'view.set',args:{field:{frame:2}}});
    const field=await service.dispatch({name:'field.result',args:{id:job.id,frame:2,traces:true}});expect(field.stale).toBe(true);expect(field.meta.project).toEqual(source);expect(field.frame.data.length).toBeGreaterThan(0);
    const chunks:Buffer[]=[];let offset:number|null=0;while(offset!==null){const chunk=await service.dispatch({name:'artifact.read',args:{id:field.artifact.id,offset,length:65536}});expect(chunk.offset).toBe(offset);chunks.push(Buffer.from(chunk.data,'base64'));offset=chunk.nextOffset;}expect(Buffer.concat(chunks)).toEqual(await readFile(field.artifact.path));
    await expect(service.dispatch({name:'artifact.read',args:{id:field.artifact.id,offset:field.artifact.size+1,length:10}})).rejects.toMatchObject({code:'ARTIFACT_RANGE'});await service.close();
    const restored=await new DesignService(service.options).initialize();expect((await restored.dispatch({name:'field.result',args:{id:job.id,frame:2}})).frame).toEqual(field.frame);await restored.close();
  },20000);
  it('commits atomic edits, rejects stale revisions, undoes/redoes and persists the same project',async()=>{
    const service=await setup();const initial=service.state.project.design.length;
    const changed=await service.dispatch({name:'workspace.batch',expectedRevision:0,args:{commands:[{name:'project.patch',args:{name:'Agent test',design:{length:2.2}}},{name:'layout.convert'}],requireValidGeometry:true}});
    expect(changed.revision).toBe(1);expect(changed.project.layout).toBeDefined();
    await expect(service.dispatch({name:'project.patch',expectedRevision:0,args:{name:'Overwrite'}})).rejects.toMatchObject({code:'REVISION_CONFLICT'});
    const before=structuredClone(service.state);
    await expect(service.dispatch({name:'workspace.batch',args:{commands:[{name:'project.patch',args:{name:'Should roll back'}},{name:'baffle.remove',args:{id:'missing'}}]}})).rejects.toThrow('Unknown baffle');
    expect(service.state).toEqual(before);
    await service.dispatch({name:'history.undo'});expect(service.state.project.design.length).toBe(initial);expect(service.state.revision).toBe(2);
    await service.dispatch({name:'history.redo'});expect(service.state.project.name).toBe('Agent test');
    const restored=await new DesignService(service.options).initialize();expect(restored.state).toEqual(service.state);await restored.dispatch({name:'history.undo'});expect(restored.state.project.name).not.toBe('Agent test');
    await service.close();await restored.close();
  });
  it('runs real worker analyses, exposes per-job source revisions and rejects stale candidate application',async()=>{
    const service=await setup();const run=await service.dispatch({name:'analysis.run',args:{samples:40}});const finished=await done(service,run.id);expect(finished.status).toBe('completed');expect(finished.result.points.length).toBeGreaterThan(40);
    const search=await service.dispatch({name:'analysis.optimise',args:{parameters:[{path:'design.length',min:1.7,max:2.2}],iterations:20}});const candidates=await done(service,search.id);expect(candidates.status).toBe('completed');expect(candidates.result.length).toBeGreaterThan(0);
    await service.dispatch({name:'project.patch',args:{name:'Changed while search was running'}});
    await expect(service.dispatch({name:'job.apply',args:{id:search.id}})).rejects.toMatchObject({code:'STALE_RESULT'});
    const sweep=await service.dispatch({name:'analysis.sweep',args:{path:'driver.qes',values:[.2,.4,0],samples:40}});const result=await done(service,sweep.id);expect(result.result[2].errors.length).toBeGreaterThan(0);
    const cancel=await service.dispatch({name:'analysis.optimise',args:{}});await service.dispatch({name:'job.cancel',args:{id:cancel.id}});expect((await service.dispatch({name:'job.get',args:{id:cancel.id}})).status).toBe('cancelled');
    await service.close();
  },20000);
  it('exports the actual custom geometry manifest, imports legacy JSON and rejects path traversal',async()=>{
    const service=await setup();await service.dispatch({name:'layout.convert'});
    const artifact=await service.dispatch({name:'export.create',args:{format:'manifest'}});const manifest=JSON.parse(await readFile(artifact.path,'utf8'));expect(manifest.panels.some((p:any)=>p.footprint)).toBe(true);
    const again=await service.dispatch({name:'export.create',args:{format:'manifest'}});expect(again.path).not.toBe(artifact.path);expect(JSON.parse((await service.dispatch({name:'artifact.read',args:{id:artifact.id}})).data)).toEqual(manifest);
    await writeFile(path.join(service.files,'legacy.wavelab.json'),JSON.stringify(service.state.project));await service.dispatch({name:'project.open',args:{filename:'legacy.wavelab.json'}});
    await expect(service.dispatch({name:'project.save',args:{filename:'../escape.json'}})).rejects.toMatchObject({code:'INVALID_PATH'});
    await expect(service.dispatch({name:'project.patch',args:{driver:{xmax:-3}}})).rejects.toThrow();
    await service.close();
  });
});
