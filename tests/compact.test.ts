import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {compactDataset} from '../scripts/compact-data.mjs';
import {readMove} from '../scripts/read-move.mjs';
import {validateDataset} from '../scripts/validate-data.mjs';
import {sandboxMove} from '../src/data/sandbox';
import {zipDirectory} from '../scripts/zip-directory.mjs';
import {unzipSync} from 'fflate';
it('Compacts exact duplicate payloads without changing identities or frames, and checks shared checksums',async()=>{
  const parent=resolve('artifacts');await mkdir(parent,{recursive:true});
  const root=await mkdtemp(join(parent,'compaction-test-'));
  try{
    const originals=[{...sandboxMove,moveId:'first',name:'AttackS4S'},{...sandboxMove,moveId:'second',name:'AttackS4S_1'}];
    const entries=[];
    for(const move of originals){const bytes=gzipSync(JSON.stringify(move));const path=`${move.moveId}.json.gz`;await writeFile(join(root,path),bytes);entries.push({id:move.moveId,internalName:move.name,path,totalFrames:move.frames.length,sha256:createHash('sha256').update(bytes).digest('hex'),warnings:[]});}
    await writeFile(join(root,'index.json'),JSON.stringify({schemaVersion:1,id:'synthetic',attributes:{},moves:entries}));
    await writeFile(join(root,'manifest.json'),JSON.stringify({schemaVersion:1,game:'Project+',version:'3.2',parser:{name:'brawllib_rs',version:'0.29.0'},verification:'unverified',partial:true,fighters:[{id:'synthetic',path:'index.json',moveCount:2}],sourceChecksums:[{source:'brawl',sha256:'a'.repeat(64)}]}));
    const canonical=await readFile(join(root,'first.json.gz'));
    const result=await compactDataset(root);expect(result.aliases).toBe(1);expect(result.saved).toBeGreaterThan(0);
    expect(await readFile(join(root,'first.json.gz'))).toEqual(canonical);
    expect(await readMove(root,'second.json.gz')).toEqual(originals[1]);await validateDataset(root);
    const archive=join(parent,`compaction-zip-${Date.now()}.zip`);
    try{
      await zipDirectory(root,archive,'P+ Dojo');
      const files=unzipSync(await readFile(archive));
      expect(Buffer.from(files['P+ Dojo/first.json.gz'])).toEqual(canonical);
      expect(Buffer.from(files['P+ Dojo/second.json.gz'])).toEqual(await readFile(join(root,'second.json.gz')));
      expect(JSON.parse(new TextDecoder().decode(files['P+ Dojo/manifest.json'])).fighters[0].id).toBe('synthetic');
    }finally{await rm(archive,{force:true});}
    await writeFile(join(root,'first.json.gz'),Buffer.from('damaged'));
    await expect(readMove(root,'second.json.gz')).rejects.toThrow('Shared move checksum mismatch');
    await expect(readMove(root,'../escape.json.gz')).rejects.toThrow('Dataset path escapes');
  }finally{if(!root.startsWith(parent+sep))throw new Error('Unsafe test cleanup');await rm(root,{recursive:true,force:true});}
});
