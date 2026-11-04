import { _electron as electron } from "playwright";
import electronPath from "electron";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

class SystemStudyPage {
  constructor(page){this.page=page;}
  call(name,args={}){return this.page.evaluate(c=>window.desktop.command(c),{name,args});}
  state(){return this.call('workspace.get');}
  async complete(id){for(let i=0;i<300;i++){const j=await this.call('job.get',{id,includeResult:true});if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,100));}throw Error('Comparison job timeout');}
}
const out = resolve("test-results/system");
await mkdir(out, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "aegir-system-")),
  env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.WAVELAB_DEV;
const app = await electron.launch({
  executablePath: electronPath,
  args: [resolve("."), "--user-data-dir=" + profile],
  env,
  timeout: 45000,
});
const page = await app.firstWindow(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ui = new SystemStudyPage(page);
try {
  await page.getByRole('heading',{name:'Make room for your sound.'}).waitFor();
  const project=JSON.parse(await readFile('examples/satori-reference.aegir.json','utf8'));
  await ui.call('project.replace',{project});
  await ui.call('view.set',{tab:'design',section:false,path:false,camera:{eye:[-350,650,-2000],target:[139.7,479.425,171.45]}});
  await page.locator('.three-mount canvas').waitFor();
  await page.screenshot({path:join(out,'two-driver-cabinet.png')});
  await page.getByRole('navigation',{name:'Design workflow'}).getByRole('button',{name:/Simulate$/}).click();
  await page.getByRole('heading',{name:'Explore this enclosure in 3D.'}).waitFor();
  assert.equal(await page.getByText('Published-reference checks',{exact:true}).count(),0);
  assert.deepEqual((await ui.state()).project,project);
  const check=await ui.call('project.validate');
  assert.equal(check.physicalValid,true);assert.equal(check.analysisAvailable,false);assert.equal(check.referenceAnalysisAvailable,true);
  await assert.rejects(ui.call('analysis.run'),/continuous acoustic route/);
  const bad=structuredClone(project);bad.system.profile.sections[1].distance=0;
  await assert.rejects(ui.call('project.replace',{project:bad}));
  assert.deepEqual((await ui.state()).project,project);
  const run=await ui.call('analysis.reference',{samples:240}),job=await ui.complete(run.id);
  assert.equal(job.status,'completed');assert.equal(job.result.reference.drivers.length,2);
  assert.equal(job.result.reference.modal.status,'mismatch');assert.equal(job.result.reference.curves[0].status,'incompatible');
  await page.reload();await page.getByRole('heading',{name:'Explore this enclosure in 3D.'}).waitFor();
  assert.deepEqual((await ui.state()).project,project);
  assert.deepEqual(errors,[]);
  console.log('System desktop E2E passed: two-driver project preserved, actual geometry required, invalid-profile rejection, developer comparison retained outside the product UI, reload persistence.');
} catch (error) {
  await page.screenshot({ path: join(out, "failure.png"), fullPage: true });
  throw error;
} finally {
  await app.close();
}
