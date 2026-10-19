const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {resolveAsset} = require('../../desktop/paths.cjs');
test('desktop assets stay inside the bundled app, including encoded paths',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'dojo-path-test-'));
  try{
    await fs.mkdir(path.join(folder,'app'));await fs.writeFile(path.join(folder,'app','index.html'),'ok');await fs.writeFile(path.join(folder,'secret'),'private');
    const root=path.join(folder,'app');assert.equal(await resolveAsset(root,'dojo://app/'),await fs.realpath(path.join(root,'index.html')));
    for(const url of ['https://example.com/','dojo://other/','dojo://app/%2e%2e%2fsecret','dojo://app/%5csecret','dojo://app/C%3a/secret','dojo://app/%00','dojo://app/%GG'])await assert.rejects(resolveAsset(root,url));
  }finally{await fs.rm(folder,{recursive:true,force:true});}
});
