import {afterEach,expect,it} from 'vitest';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {unzipSync} from 'fflate';

const temporary:string[]=[];
function repository(){
  const root=mkdtempSync(join(tmpdir(),'dojo-source-package-'));temporary.push(root);
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'ignore'});
  git('init','-q');git('config','user.name','Source package test');git('config','user.email','test@example.invalid');
  git('config','core.autocrlf','false');git('config','commit.gpgsign','false');
  mkdirSync(join(root,'scripts'));copyFileSync('scripts/package-source.mjs',join(root,'scripts/package-source.mjs'));
  writeFileSync(join(root,'README.md'),'Committed public documentation.\n');
  git('add','.');git('commit','-q','-m','Fixture');
  return {root,git,pack:()=>spawnSync(process.execPath,['scripts/package-source.mjs'],{cwd:root,encoding:'utf8'})};
}
afterEach(()=>{for(const root of temporary.splice(0)){
  if(!resolve(root).startsWith(resolve(tmpdir())+sep)||!root.split(/[\\/]/).at(-1)?.startsWith('dojo-source-package-'))throw new Error('Unexpected cleanup path');
  rmSync(root,{recursive:true,force:true});
}});

it('exports only the committed source, excluding local notes and environment files',()=>{
  const {root,pack}=repository();
  mkdirSync(join(root,'docs'));writeFileSync(join(root,'docs/private.md'),'Local owner notes.');
  writeFileSync(join(root,'.env.local'),'LOCAL_TEST_ONLY=1');
  writeFileSync(join(root,'README.md'),'Uncommitted draft.');
  const result=pack();expect(result.status,result.stderr).toBe(0);
  const entries=unzipSync(readFileSync(join(root,'artifacts/PPlus-Dojo-Source.zip')));
  expect(Object.keys(entries).filter(p=>!p.endsWith('/')).sort()).toEqual([
    'PPlus-Dojo-Source/README.md','PPlus-Dojo-Source/scripts/package-source.mjs',
  ]);
  expect(new TextDecoder().decode(entries['PPlus-Dojo-Source/README.md'])).toBe('Committed public documentation.\n');
},15000);

it('refuses an accidentally committed owner-notes directory',()=>{
  const {root,git,pack}=repository();
  mkdirSync(join(root,'docs'));writeFileSync(join(root,'docs/private.md'),'Local owner notes.');
  git('add','docs');git('commit','-q','-m','Accidental owner notes');
  const result=pack();expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Refusing to package local-only files');
  expect(result.stderr).toContain('docs/private.md');
},15000);
