import {gunzipSync} from 'fflate';
import {packMoveGeometry} from './packed-geometry';
const decoder=self as unknown as {postMessage:(value:unknown,transfer:Transferable[])=>void};
self.onmessage=(event:MessageEvent<{id:number;bytes:ArrayBuffer;gzip:boolean;pack:boolean}>)=>{
  const {id,bytes,gzip,pack}=event.data;
  try{const input=new Uint8Array(bytes);const isGzip=gzip&&input[0]===0x1f&&input[1]===0x8b;const value=JSON.parse(new TextDecoder().decode(isGzip?gunzipSync(input):input));
    if(pack&&Array.isArray(value.frames)){const packed=packMoveGeometry(value);decoder.postMessage({id,value:packed,packed:true},[packed.geometry.buffer as ArrayBuffer,packed.offsets.buffer as ArrayBuffer]);}
    else self.postMessage({id,value});}
  catch{self.postMessage({id,error:'This dataset file is damaged or is not valid JSON. Rebuild or reinstall the data package.'});}
};
