import {describe,it,expect} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {DesignService} from '../src/agent/service';
import {startBridge} from '../src/agent/bridge';
describe('local capability bridge',()=>{
  it('rejects unauthenticated, browser-origin and malformed Unicode tokens, and serves authenticated MCP commands',async()=>{
    const directory=await fs.mkdtemp(path.join(tmpdir(),'aegir-bridge-')),service=await new DesignService({directory,workerPath:path.resolve('engine/worker.cjs')}).initialize();
    const file=path.join(directory,'connection.json'),bridge=await startBridge(service,file,{executable:'test',args:[]});
    const info=JSON.parse(await fs.readFile(file,'utf8'));
    try{
      expect((await fetch(info.url+'/health')).status).toBe(403);
      expect((await fetch(info.url+'/health',{headers:{Authorization:'Bearer '+info.token,Origin:'https://example.com'}})).status).toBe(403);
      // Latin-1 headers are legal HTTP but may have more UTF-8 bytes than JS string length.
      expect((await fetch(info.url+'/health',{headers:{Authorization:'Bearer '+'é'.repeat(64)}})).status).toBe(403);
      const response=await fetch(info.url+'/command',{method:'POST',headers:{Authorization:'Bearer '+info.token,'Content-Type':'application/json'},body:JSON.stringify({name:'project.patch',args:{name:'Authenticated agent'}})});
      expect(response.status).toBe(200);expect((await response.json()).result.project.name).toBe('Authenticated agent');
    }finally{await bridge.close();await service.close();}
  });
  it('rejects file and junction traversal before creating anything outside the workspace',async()=>{
    const directory=await fs.mkdtemp(path.join(tmpdir(),'aegir-paths-')),outside=await fs.mkdtemp(path.join(tmpdir(),'aegir-outside-')),service=await new DesignService({directory,workerPath:path.resolve('engine/worker.cjs')}).initialize();
    await fs.symlink(outside,path.join(service.files,'link'),process.platform==='win32'?'junction':'dir');
    await expect(service.dispatch({name:'project.save',args:{filename:'link/new-directory/escape.json'}})).rejects.toMatchObject({code:'INVALID_PATH'});
    expect(await fs.readdir(outside)).toEqual([]);await service.close();
  });
});
