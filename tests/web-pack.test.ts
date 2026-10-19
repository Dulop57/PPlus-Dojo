import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {packReference} from '../scripts/build-cloudflare.mjs';
it('preserves reference bytes and shared paths; unchanged fighters retain their download hashes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'dojo-web-pack-'));expect(resolve(root).startsWith(resolve(tmpdir())+sep)).toBe(true);
  try{
    const source=join(root,'source');for(const path of ['data/marth/moves','data/fox/moves','study'])await mkdir(join(source,path),{recursive:true});
    const originals=new Map<string,Buffer>();
    for(const [path,value] of Object.entries({'data/manifest.json':{schemaVersion:1,fighters:[{path:'marth/index.json'}]},'data/marth/index.json':{schemaVersion:1,moves:[{path:'marth/moves/alias.json.gz'}]},'data/marth/moves/base.json.gz':{schemaVersion:1,frames:[{index:0,value:1.23456789012345}]},'data/marth/moves/alias.json.gz':{schemaVersion:1,sharedMove:{path:'marth/moves/base.json.gz',sha256:'original-reference'}},'data/fox/moves/base.json.gz':{schemaVersion:1,frames:[{index:0,value:7}]},'study/index.json':{schemaVersion:1,sourcePath:'marth/index.json'}})){
      const bytes=Buffer.from(JSON.stringify(value));originals.set(path,bytes);await writeFile(join(source,path),path.endsWith('.gz')?gzipSync(bytes):bytes);
    }
    const first=await packReference(source,join(root,'one'),256),second=await packReference(source,join(root,'two'),256);
    expect(second.path).toBe(first.path);
    for(const [path,entry] of Object.entries(first.catalog.files) as [string,any][]){const pack=await readFile(join(root,'one',entry.pack));expect(gunzipSync(pack.subarray(entry.offset,entry.offset+entry.length))).toEqual(originals.get(path));}
    await writeFile(join(source,'data/marth/moves/base.json.gz'),gzipSync(JSON.stringify({schemaVersion:1,frames:[{index:0,value:9}]})));
    const changed=await packReference(source,join(root,'three'),256);
    expect(changed.catalog.files['data/fox/moves/base.json.gz'].pack).toBe(first.catalog.files['data/fox/moves/base.json.gz'].pack);
    expect(changed.catalog.files['data/marth/moves/base.json.gz'].pack).not.toBe(first.catalog.files['data/marth/moves/base.json.gz'].pack);
  }finally{await rm(root,{recursive:true,force:true});}
});
