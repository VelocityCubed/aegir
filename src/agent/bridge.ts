import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {DesignService,DomainError} from './service';
import type {Command} from './contracts';
export async function startBridge(service:DesignService,connectionFile:string,launch:{executable:string;args:string[]}){
  const token=randomBytes(32).toString('hex');
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const supplied=req.headers.authorization?.replace(/^Bearer /,'')??'';
    const host=req.headers.host??'';
    if(!/^127\.0\.0\.1:\d+$/.test(host)||req.headers.origin||Buffer.byteLength(supplied)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(token))){res.statusCode=403;res.end(JSON.stringify({error:{code:'FORBIDDEN',message:'Local authenticated ÆGIR bridge only.'}}));return;}
    if(req.url==='/health'&&req.method==='GET'){res.end(JSON.stringify({name:'aegir-desktop',revision:service.state.revision}));return;}
    if(req.url!=='/command'||req.method!=='POST'){res.statusCode=404;res.end(JSON.stringify({error:{code:'NOT_FOUND',message:'Unknown endpoint.'}}));return;}
    try{
      const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw new DomainError('REQUEST_TOO_LARGE','Command exceeds 2 MiB.');chunks.push(chunk);}
      const input=JSON.parse(Buffer.concat(chunks).toString('utf8')) as Command;
      const result=await service.dispatch({...input,actor:'mcp'});res.end(JSON.stringify({result}));
    }catch(error:any){res.statusCode=error.code==='REVISION_CONFLICT'?409:400;res.end(JSON.stringify({error:{code:error.code??'INVALID_COMMAND',message:error.message,details:error.details??error.issues}}));}
  });
  server.requestTimeout=30000;server.headersTimeout=10000;
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve());});
  const address=server.address();if(!address||typeof address==='string')throw Error('Bridge address unavailable.');
  await fs.mkdir(path.dirname(connectionFile),{recursive:true});
  await fs.writeFile(connectionFile,JSON.stringify({version:1,pid:process.pid,url:`http://127.0.0.1:${address.port}`,token,launch,filesDirectory:service.files},null,2),{mode:0o600});
  return {connectionFile,close:()=>new Promise<void>(resolve=>server.close(()=>resolve()))};
}
