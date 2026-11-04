import {readFileSync} from 'node:fs';
import {prepareField} from '../src/field/grid';
const p=JSON.parse(readFileSync('docs/speaker-design/models/Anatomy-2006-straight-empty.aegir.json','utf8'));
for(const h of [20,16,12]){const start=performance.now();try{const g=prepareField(p,{cellMm:h,paddingMm:180,frequency:100,durationMs:100,signal:'steady',frames:64,volume:false});console.log(JSON.stringify({h,quality:g.meta.quality,steps:g.meta.steps,cells:g.meta.cells,seconds:(performance.now()-start)/1000,sourceCells:g.sourceCells.length}));}catch(e){console.log(JSON.stringify({h,error:String(e),seconds:(performance.now()-start)/1000}));}}
