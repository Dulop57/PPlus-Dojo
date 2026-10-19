import {readdir,readFile,mkdir,rename} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {once} from 'node:events';
import {finished} from 'node:stream/promises';
import {Zip,ZipPassThrough,ZipDeflate} from 'fflate';
// Stream already-compressed move files directly into ZIP instead of recompressing
// a gigabyte of gzip data. Standard ZIP readers, including Explorer, are supported.
export async function zipDirectory(directory,destination,prefix=''){
  const root=resolve(directory),target=resolve(destination),temporary=target+'.tmp';
  await mkdir(dirname(target),{recursive:true});
  const output=createWriteStream(temporary);let failure;
  output.on('error',error=>{failure=error;});
  const zip=new Zip((error,data)=>{if(error){failure=error;output.destroy(error);}else output.write(data);});
  try{
    async function walk(folder,relative=''){
      for(const entry of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
        if(entry.isSymbolicLink())throw new Error('Archive inputs must not contain symlinks');
        const path=join(folder,entry.name),name=relative?`${relative}/${entry.name}`:entry.name;
        if(entry.isDirectory()){await walk(path,name);continue;}
        const archiveName=prefix?`${prefix}/${name}`:name;
        const file=/\.(gz|pak|woff2|png|jpg|jpeg|wasm|zip)$/i.test(name)?new ZipPassThrough(archiveName):new ZipDeflate(archiveName,{level:6});
        zip.add(file);file.push(await readFile(path),true);
        if(failure)throw failure;
        if(output.writableNeedDrain)await once(output,'drain');
      }
    }
    await walk(root);zip.end();output.end();await finished(output);
    if(failure)throw failure;
    await rename(temporary,target);
  }catch(error){zip.terminate();output.destroy();throw error;}
}
