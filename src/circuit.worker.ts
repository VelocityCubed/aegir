import {previewCircuit} from './core/circuit-preview';
self.onmessage=event=>{try{postMessage({key:event.data.key,...previewCircuit(event.data.project,event.data.circuit)});}catch(e){postMessage({key:event.data.key,issues:[(e as Error).message],points:[]});}};
