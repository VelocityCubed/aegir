import {standingWave} from './core/acoustics';
import {buildGeometry} from './core/geometry';
self.onmessage=event=>{const {key,project,frequency}=event.data;try{postMessage({key,points:buildGeometry(project).errors.length?[]:standingWave(project,frequency)});}catch(error){postMessage({key,points:[],error:(error as Error).message});}};
