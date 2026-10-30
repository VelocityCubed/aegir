import {_electron as electron} from 'playwright';
import {mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.WAVELAB_DEV;delete env.WAVELAB_PYTHON;
const userData=await mkdtemp(join(tmpdir(),'wavelab-package-'));
const executable=process.env.WAVELAB_TEST_EXE||resolve('release/win-unpacked/AEONFORGE Aegir.exe');
const out=resolve('test-results');
const app=await electron.launch({executablePath:executable,args:['--user-data-dir='+userData],env,timeout:60000});
try {
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('heading',{name:'A quarter wave. A world of possibilities.'}).waitFor();await page.locator('.three-mount canvas').waitFor();
  await app.evaluate(({dialog},out)=>{dialog.showSaveDialog=async(_w,options)=>({canceled:false,filePath:out+'/packaged-'+options.defaultPath.split(/[\\/]/).at(-1)});},out);
  await page.getByRole('button',{name:'Optimisation',exact:true}).click();await page.getByRole('button',{name:'Run optimisation',exact:true}).click();await page.getByRole('button',{name:'Use this design',exact:true}).first().waitFor({timeout:45000});
  await page.getByRole('button',{name:'Use this design',exact:true}).first().click();
  await page.getByRole('button',{name:'Build & export',exact:true}).click();
  await page.getByRole('button',{name:'Export ZIP bundle',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved Quarter-wave-study-build.zip'}).waitFor({timeout:20000});
  await page.waitForFunction(()=>document.querySelector('.success')?.textContent?.includes('CadQuery'),null,{timeout:60000});
  await page.getByRole('button',{name:'Export STEP',exact:true}).click();await page.getByRole('status').filter({hasText:'STEP assembly exported.'}).waitFor({timeout:120000});
  assert.ok((await stat(join(out,'packaged-enclosure.step'))).size>5000);assert.deepEqual(errors,[]);
  console.log('Packaged app smoke passed: local renderer, WebGL, worker search, manufacturing ZIP, automatic local CAD discovery and STEP export.');
} finally {await app.close();}
