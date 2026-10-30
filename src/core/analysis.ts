import {simulate} from './acoustics';
import type {Project,Simulation} from './types';
import {buildGeometry} from './geometry';
export function safeSimulate(project:Project):Simulation & {error?:string}{
  try{const g=buildGeometry(project);if(g.errors.length)throw Error(g.errors.join(' '));return simulate(project);}catch(error){return {error:(error as Error).message,points:[],quarterWave:0,planeWaveLimit:0,radiationLimit:0,peakExcursion:0,peakVelocity:0,bandMean:0,ripple:0,f3:null};}
}
