import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
const deps=['electron','react','react-dom','three','fflate','lucide-react','@modelcontextprotocol/server','@modelcontextprotocol/core','scheduler','zod'];
await mkdir('docs/licenses',{recursive:true});
let notices='# Third-party notices\n\nOriginal application code is governed by the custom AEGIR Personal Use and Contribution-Back License 1.0 in LICENSE. Its restrictions apply only to project-owned material. These dependencies retain their own licences. Electron/Chromium binary notices are also distributed beside the packaged executable. Optional CadQuery (Apache-2.0) and OpenCascade/runtime dependencies are separately installed, not bundled. OpenSCAD and Gmsh are not bundled.\n\n';
for(const name of deps){
  const dir='node_modules/'+name,pkg=JSON.parse(await readFile(dir+'/package.json','utf8'));
  const file=(await readdir(dir)).find(n=>/^license(?:\.md|\.txt)?$/i.test(n));
  if(!file)throw Error('Missing licence: '+name);
  const target=name.replaceAll('/','-')+'-LICENSE.txt';
  await writeFile('docs/licenses/'+target,await readFile(dir+'/'+file));
  notices+=`- ${name} ${pkg.version} — ${pkg.license}: [licence](licenses/${target})\n`;
}
await writeFile('docs/THIRD-PARTY.md',notices);
console.log('Collected upstream notices.');
