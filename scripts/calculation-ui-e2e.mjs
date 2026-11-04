import {_electron as electron} from 'playwright';
import {expect} from 'playwright/test';
import electronPath from 'electron';
import {readFile,mkdtemp,mkdir,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const out=resolve('test-results/convergence/ui-flow'),profile=await mkdtemp(join(tmpdir(),'aegir-quality-ui-'));await mkdir(out,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.WAVELAB_DEV;
const app=await electron.launch({executablePath:process.env.AEGIR_TEST_APP??electronPath,args:[...(process.env.AEGIR_TEST_APP?[]:[resolve('.')]),'--user-data-dir='+profile],env,timeout:45000}),page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
class QualityPage{
 command(name,args={}){return page.evaluate(c=>window.desktop.command(c),{name,args});}
 async number(name,value){const input=page.getByRole('spinbutton',{name,exact:true});await input.fill(String(value));await input.press('Tab');}
 check(){return page.getByRole('button',{name:'Check calculation quality',exact:true});}
}
const ui=new QualityPage();
try{
 await page.getByRole('navigation',{name:'Design workflow'}).waitFor();
 const p=JSON.parse(await readFile('docs/speaker-design/models/Anatomy-2006-straight-empty.aegir.json','utf8'));
 p.name='Synthetic small-cabinet calculation workflow fixture';p.design.length=.5;p.layout.height=536;p.layout.route[0][1]=500;p.system.references=[];p.system.physics.ductLoss='none';
 await ui.command('project.replace',{project:p,requireValidGeometry:true});const initial=await ui.command('workspace.get');await ui.command('view.set',{tab:'field',study:'waves'});
 await ui.number('Wave frequency',1000);await page.getByText('Calculation settings',{exact:false}).first().click();
 await ui.number('Grid cell size',20);await ui.number('Exterior padding',180);await ui.number('Physical duration',20);
 await ui.check().click();await expect(page.getByRole('button',{name:'Cancel check',exact:true})).toBeVisible();
 await expect(ui.check()).toBeEnabled({timeout:180000});
 await expect(page.getByText(/More refinement is needed|Grid changes are small at this frequency/, {exact:true})).toBeVisible();
 const files=(await readdir(join(profile,'agent/files'))).filter(s=>/^field-check-.*\.json$/.test(s));assert.equal(files.length,1);
 const report=JSON.parse(await readFile(join(profile,'agent/files',files[0]),'utf8'));assert.equal(report.jobs.length,5);assert.equal(report.frequencyHz,1000);assert(report.shift&&report.padding);assert.deepEqual((await ui.command('workspace.get')).project,initial.project);
 // Unloaded native modal workflow also uses the new geometry through the real service.
 const modal=await ui.command('analysis.modal',{cellMm:[20,16,12],count:4});let done;
 for(let k=0;k<600;k++){done=await ui.command('job.get',{id:modal.id,includeResult:true});if(done.status!=='running')break;await new Promise(r=>setTimeout(r,200));}
 assert.equal(done.status,'completed',done.error);assert(done.result.studies.every(s=>s.meta.geometry==='conservative-cut-cell'));assert(done.result.studies.every(s=>Math.abs(s.meta.bodyCavityLitres-20)<1e-7));
 await page.screenshot({path:join(out,'quality-check.png'),fullPage:true});assert.deepEqual(errors,[]);
 await page.reload();await page.getByRole('navigation',{name:'Design workflow'}).waitFor();assert.deepEqual((await ui.command('workspace.get')).project,initial.project);
 await writeFile(join(out,'verification.json'),JSON.stringify({profile,uiStartedFiveRuns:true,report,modal:{job:modal.id,result:done.result},projectUnchanged:true,persisted:true,errors},null,2));console.log('Actual quality button, five native jobs, saved report, native cut-cell modes and project persistence passed.');
}catch(e){await page.screenshot({path:join(out,'failure.png'),fullPage:true});throw e;}finally{await app.close();}
