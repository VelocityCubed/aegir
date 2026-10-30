import {safeSimulate} from './core/analysis';
self.onmessage=event=>{const {key,project,comparisons}=event.data;postMessage({key,simulation:safeSimulate(project),comparisons:comparisons.map((item:any)=>({...item,simulation:safeSimulate(item.project)}))});};
