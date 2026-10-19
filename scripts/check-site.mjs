import { readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
export async function checkSite(folder) {
  let total=0,files=0;
  async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isSymbolicLink())throw new Error(`Symlinks are not allowed in the distributable: ${path}`);
    if(entry.isDirectory())await walk(path);else{
      if(/\.(pac|pcs|gct|iso|wbfs)$/i.test(entry.name))throw new Error(`Raw game file must not be published: ${path}`);
      total+=(await stat(path)).size;files++;
    }
  }}
  await walk(resolve(folder));
  if(total>1_000_000_000)throw new Error(`Static website is ${(total/1e9).toFixed(2)} GB; it exceeds the 1 GB Pages budget.`);
  console.log(`Static artifact: ${files} files, ${(total/1024/1024).toFixed(2)} MiB (under the 1 GB Pages limit).`);
  return {files,total};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))await checkSite(process.argv[2]??'dist');
