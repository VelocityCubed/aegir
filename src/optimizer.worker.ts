import { optimize } from './core/optimizer';
import { validateProject } from './core/validation';
self.onmessage=async(event)=>{
  try {
    validateProject(event.data);
    const results=await optimize(event.data,(progress,valid)=>postMessage({type:'progress',progress,valid}));
    postMessage({type:'done',results});
  } catch(error) {postMessage({type:'error',message:error instanceof Error?error.message:String(error)});}
};
