import {useEffect,useMemo,useState} from 'react';
import type {Project,Snapshot,Simulation} from '../core/types';
const unavailable=(message:string):Simulation&{error:string}=>({error:message,points:[],quarterWave:0,planeWaveLimit:0,radiationLimit:0,peakExcursion:0,peakVelocity:0,bandMean:0,ripple:0,f3:null});
export function useSimulation(project:Project,snapshots:Snapshot[],active:string[]){
  const input=useMemo(()=>({project,comparisons:snapshots.filter(s=>active.includes(s.id)).map(s=>({name:s.name,color:s.color,project:s.project}))}),[project,snapshots,JSON.stringify(active)]);
  const key=useMemo(()=>JSON.stringify(input),[input]);
  const [result,setResult]=useState<{key:string;simulation:Simulation&{error?:string};comparisons:{name:string;color:string;simulation:Simulation}[]}|null>(null);
  useEffect(()=>{const worker=new Worker(new URL('../simulation.worker.ts',import.meta.url),{type:'module'});worker.onmessage=event=>setResult(event.data);worker.onerror=event=>setResult({key,simulation:unavailable(event.message||'Simulation worker failed.'),comparisons:[]});worker.postMessage({key,...input});return()=>worker.terminate();},[key]);
  const pending=result?.key!==key;
  return {pending,simulation:pending?unavailable('Calculating the new response…'):result!.simulation,comparisons:pending?[]:result!.comparisons};
}
export function usePressure(project:Project,frequency:number){
  const key=useMemo(()=>JSON.stringify([project,frequency]),[project,frequency]);
  const [result,setResult]=useState<{key:string;points:{s:number;pressure:number}[];error?:string}|null>(null);
  useEffect(()=>{const worker=new Worker(new URL('../pressure.worker.ts',import.meta.url),{type:'module'});worker.onmessage=event=>setResult(event.data);worker.onerror=event=>setResult({key,points:[],error:event.message});worker.postMessage({key,project,frequency});return()=>worker.terminate();},[key]);
  const pending=result?.key!==key;return {pending,points:pending?[]:result!.points,error:pending?undefined:result!.error};
}
