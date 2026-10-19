import {mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

// Export only the committed Git tree. Recursive directory copying can include
// ignored credentials, owner notes, design projects, and local caches.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function git(args){
  try{return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
  catch{throw new Error('Source packaging needs a Git checkout with a committed HEAD. Commit the reviewed source files first.');}
}
const files=git(['ls-tree','-r','--name-only','-z','HEAD']).split('\0').filter(Boolean);
const excluded=files.filter(path=>
  /(^|\/)(docs|node_modules|__pycache__|\.wrangler|\.firebase|\.tools|artifacts|dist|dist-web|dist-sandbox|target|inputs|Game Files)(\/|$)/i.test(path)||
  /^public\/(study\/|data\/(?!\.gitkeep$))/.test(path)||
  /(^|\/)(desktop\.config\.json|\.env(?:\..*)?|[^/]*(?:service[-_]?account|firebase-adminsdk)[^/]*\.json)$/i.test(path)&&!/^\.env(?:\..*)?\.example$/.test(path)||
  /\.(psd|aep|zip|py[cod]|pem|key|p12|pfx|pac|pcs|gct|iso|wbfs)$/i.test(path));
if(excluded.length)throw new Error(`Refusing to package local-only files tracked by HEAD:\n${excluded.join('\n')}`);
const zip=join(root,'artifacts','PPlus-Dojo-Source.zip');
await mkdir(dirname(zip),{recursive:true});
git(['archive','--format=zip','--prefix=PPlus-Dojo-Source/',`--output=${zip}`,'HEAD']);
console.log(`Created ${zip} from committed HEAD (${files.length} files).`);
