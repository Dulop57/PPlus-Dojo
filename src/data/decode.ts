let worker:Worker|undefined,id=0;
const pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;cleanup:()=>void}>();
export function decodeDataset(bytes:ArrayBuffer,gzip:boolean,signal?:AbortSignal,pack=false):Promise<unknown>{
  signal?.throwIfAborted();
  if(!worker){
    worker=new Worker(new URL('./decode.worker.ts',import.meta.url),{type:'module'});
    worker.onmessage=event=>{const job=pending.get(event.data.id);if(!job)return;pending.delete(event.data.id);job.cleanup();if(event.data.error)job.reject(new Error(event.data.error));else job.resolve(event.data.packed?unpackMoveGeometry(event.data.value):event.data.value);};
    worker.onerror=()=>{for(const job of pending.values()){job.cleanup();job.reject(new Error('The data decoder failed. Reload the app to try again.'));}pending.clear();worker?.terminate();worker=undefined;};
  }
  return new Promise((resolve,reject)=>{
    const jobId=++id;
    const abort=()=>{pending.delete(jobId);reject(new DOMException('Loading cancelled','AbortError'));};
    const cleanup=()=>signal?.removeEventListener('abort',abort);
    pending.set(jobId,{resolve,reject,cleanup});signal?.addEventListener('abort',abort,{once:true});
    worker!.postMessage({id:jobId,bytes,gzip,pack},[bytes]);
  });
}
import {unpackMoveGeometry} from './packed-geometry';
