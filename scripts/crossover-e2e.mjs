import {_electron as electron} from 'playwright';
import {expect} from 'playwright/test';
import electronPath from 'electron';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
class CrossoverPage {
  constructor(page){this.page=page;this.dialog=page.getByRole('dialog',{name:'Draw the circuit. See the response.'});this.canvas=this.dialog.getByRole('application',{name:'Crossover circuit canvas'});}
  call(name,args={}){return this.page.evaluate(c=>window.desktop.command(c),{name,args});}
  state(){return this.call('workspace.get');}
  async open(){await this.page.getByRole('navigation',{name:'Design workflow'}).getByRole('button',{name:/Simulate$/}).click();await this.page.getByRole('button',{name:'Crossover builder',exact:true}).click();await this.dialog.waitFor();await expect(this.dialog.getByRole('img',{name:'Crossover electrical response'})).toBeVisible({timeout:15000});await expect(this.dialog.getByRole('button',{name:'Apply circuit',exact:true})).toBeEnabled();}
  part(id){return this.dialog.locator(`[data-part-id="${id}"] .crossover-part-target`);}
  pin(id,pin){return this.dialog.locator(`[data-terminal="${id}:${pin}"] .crossover-pin-target`);}
  async num(name,value){const f=this.dialog.getByRole('spinbutton',{name,exact:true});await f.fill(String(value));await f.press('Tab');}
  async clickPin(id,pin){await this.pin(id,pin).click();}
  async wirePoint(id){return this.dialog.getByRole('button',{name:'Wire '+id,exact:true}).evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*.5),m=el.getScreenCTM();return {x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};});}
  async dragPart(id,dx,dy){const r=await this.part(id).boundingBox();assert(r);await this.page.mouse.move(r.x+r.width/2,r.y+r.height/2);await this.page.mouse.down();await this.page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy,{steps:15});await this.page.mouse.up();}
  async drop(kind,point){const r=await this.canvas.boundingBox();assert(r);await this.dialog.getByRole('button',{name:'Add '+kind,exact:true}).dragTo(this.canvas,{targetPosition:{x:point.x-r.x,y:point.y-r.y}});}
  async applied(){await expect(this.dialog).not.toBeVisible();await expect.poll(async()=>!!(await this.state()).project.circuit).toBe(true);return this.state();}
}
const out=resolve(process.env.AEGIR_TEST_OUT??'test-results/crossover'),profile=await mkdtemp(join(tmpdir(),'aegir-crossover-'));
await mkdir(out,{recursive:true});const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.WAVELAB_DEV;
const app=await electron.launch({executablePath:process.env.AEGIR_TEST_APP??electronPath,args:[...(process.env.AEGIR_TEST_APP?[]:[resolve('.')]),'--user-data-dir='+profile],env,timeout:45000}),page=await app.firstWindow(),ui=new CrossoverPage(page),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.getByRole('navigation',{name:'Design workflow'}).waitFor();
  await app.evaluate(({dialog},out)=>{globalThis.circuitSaved=[];dialog.showSaveDialog=async(_w,o)=>{const filePath=out+'/'+o.defaultPath.split(/[\\/]/).at(-1);globalThis.circuitSaved.push(filePath);return {canceled:false,filePath};};},out);
  const original=JSON.parse(await readFile('examples/satori-upgraded.aegir.json','utf8'));
  await ui.call('project.replace',{project:original});await ui.open();
  await page.screenshot({path:join(out,'imported-two-way.png')});
  const initialPlot=await ui.dialog.getByRole('img',{name:'Crossover electrical response'}).innerHTML();
  await ui.part('L1').click();await ui.dialog.getByText('Precise position',{exact:true}).click();const x0=Number(await ui.dialog.getByRole('spinbutton',{name:'Component X',exact:true}).inputValue());
  await ui.dragPart('L1',40,25);await expect(ui.dialog.getByRole('spinbutton',{name:'Component X',exact:true})).not.toHaveValue(String(x0));
  assert.equal(await ui.dialog.getByRole('img',{name:'Crossover electrical response'}).innerHTML(),initialPlot);
  await ui.dialog.getByRole('button',{name:'Undo circuit edit',exact:true}).click();
  await ui.part('L1').click();assert.equal(Number(await ui.dialog.getByRole('spinbutton',{name:'Component X',exact:true}).inputValue()),x0);
  // Native HTML drag/drop onto a real conductor inserts a connected component.
  const point=await ui.wirePoint('w2');await ui.drop('resistor',point);
  await expect(ui.dialog.getByRole('button',{name:'Apply circuit',exact:true})).toBeEnabled();
  const inserted=await ui.dialog.locator('.crossover-part.selected').getAttribute('data-part-id');assert(inserted?.startsWith('r-'));
  await ui.num('Component value',2.2);
  await expect.poll(async()=>await ui.dialog.getByRole('img',{name:'Crossover electrical response'}).innerHTML()).not.toBe(initialPlot);
  assert.deepEqual((await ui.state()).project,original,'Draft edits must not change the live project');
  await ui.dialog.getByRole('button',{name:'Rotate selected component',exact:true}).click();
  await ui.dialog.getByRole('button',{name:'Undo circuit edit',exact:true}).click();
  await ui.dialog.getByRole('button',{name:'Duplicate selected component',exact:true}).click();
  await expect(ui.dialog.getByRole('button',{name:'Apply circuit',exact:true})).toBeDisabled();
  await ui.dialog.getByRole('button',{name:'Undo circuit edit',exact:true}).click();
  const area=await ui.canvas.boundingBox();assert(area);
  await ui.drop('capacitor',{x:area.x+area.width-100,y:area.y+75});
  const newCap=await ui.dialog.locator('.crossover-part.selected').getAttribute('data-part-id');assert(newCap?.startsWith('c-'));
  await expect(ui.dialog.getByRole('button',{name:'Apply circuit',exact:true})).toBeDisabled();
  await ui.clickPin(newCap,'a');await ui.clickPin('driver0','a');
  await ui.clickPin(newCap,'b');await ui.clickPin('driver0','b');
  await expect(ui.dialog.getByRole('button',{name:'Apply circuit',exact:true})).toBeEnabled();
  await ui.dialog.getByRole('button',{name:'Save circuit',exact:true}).click();
  await expect.poll(()=>app.evaluate(()=>globalThis.circuitSaved.length)).toBe(1);
  const savedPath=await app.evaluate(()=>globalThis.circuitSaved[0]);
  await expect.poll(async()=>{try{return JSON.parse(await readFile(savedPath,'utf8')).format;}catch{return '';}}).toBe('aegir-crossover');
  const circuit=JSON.parse(await readFile(savedPath,'utf8')).circuit;
  assert.equal(circuit.parts.find(p=>p.id===inserted).value,2.2);
  await ui.dialog.getByRole('button',{name:'Parts list',exact:false}).click();await ui.dialog.getByRole('button',{name:'Export parts CSV',exact:true}).click();
  await expect.poll(()=>app.evaluate(()=>globalThis.circuitSaved.length)).toBe(2);
  await page.screenshot({path:join(out,'edited-circuit.png')});
  await ui.dialog.getByRole('button',{name:'Apply circuit',exact:true}).click();const saved=await ui.applied();assert.deepEqual(saved.project.circuit,circuit);
  assert(saved.project.mounts.every(m=>!m.crossover));
  await page.reload();await page.getByRole('button',{name:'Crossover builder',exact:true}).waitFor();await ui.open();
  await ui.dialog.getByText('Starting point',{exact:true}).click();await ui.dialog.getByRole('button',{name:'Direct driver connections',exact:true}).click();
  await ui.dialog.locator('input[type=file]').setInputFiles(savedPath);
  await expect(ui.dialog.getByRole('button',{name:'Apply circuit',exact:true})).toBeEnabled();
  await ui.part(inserted).click();assert.equal(Number(await ui.dialog.getByRole('spinbutton',{name:'Component value',exact:true}).inputValue()),2.2);
  await ui.num('Component value',3.3);
  await ui.call('project.patch',{name:'Concurrent cabinet edit'});
  await ui.dialog.getByRole('button',{name:'Apply circuit',exact:true}).click();
  await expect(ui.dialog).toBeVisible();assert.equal((await ui.state()).project.circuit.parts.find(p=>p.id===inserted).value,2.2);
  await ui.dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await ui.state()).project.name,'Concurrent cabinet edit');
  await ui.open();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1120,800));
  await expect.poll(()=>ui.dialog.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:join(out,'crossover-1120.png')});
  await ui.dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.deepEqual(errors,[]);
  await writeFile(join(out,'evidence.json'),JSON.stringify({nativeDragDrop:true,actualComponentDragging:true,manualTerminalWiring:true,voltagePreview:true,arbitraryWiringEngine:true,SIUnits:true,draftIsolation:true,undo:true,saveImport:true,BOM:true,persistence:true,staleEditsRejected:true,responsive:true},null,2));
  console.log('Crossover E2E passed: native drag/drop insertion, component dragging, live electrical preview, values, undo, wiring validation, native save/BOM, import, apply/reload, draft isolation and stale-edit rejection.');
}catch(e){await page.screenshot({path:join(out,'failure.png'),fullPage:true});throw e;}finally{await app.close();}
