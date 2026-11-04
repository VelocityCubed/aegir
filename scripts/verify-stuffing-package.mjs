import {extractFile} from '@electron/asar';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {normalize} from 'node:path';
const archive='release/win-unpacked/resources/app.asar';
const hash=b=>createHash('sha256').update(b).digest('hex');
const pkg=JSON.parse(extractFile(archive,'package.json').toString());assert.equal(pkg.version,JSON.parse(await readFile('package.json','utf8')).version);
const names=['engine/service.cjs','engine/worker.cjs','dist/index.html',...(await readdir('dist/assets')).filter(n=>n.endsWith('.js')).map(n=>'dist/assets/'+n)];
const files=[];for(const name of names){const actual=extractFile(archive,normalize(name)),expected=await readFile(name);assert.equal(hash(actual),hash(expected),'Packaged file differs: '+name);files.push({name,sha256:hash(actual),bytes:actual.length});}
assert(extractFile(archive,'engine/worker.cjs').toString().includes('Channel direction must be nonzero.'));
await writeFile('test-results/stuffing/package-integrity.json',JSON.stringify({version:pkg.version,archive,files,sourceBuildMatchesPackage:true},null,2));
console.log('Package'+pkg.version+' matches the verified engine, renderer and all worker bundles.');
