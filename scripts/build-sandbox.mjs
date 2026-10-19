import { spawnSync } from 'node:child_process';
// Separate QA build; does not create a Project+ dataset or enter release packaging.
const tsc=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-b'],{stdio:'inherit'});
if(tsc.status!==0)process.exit(tsc.status??1);
const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{env:{...process.env,DOJO_SANDBOX:'1'},stdio:'inherit'});
process.exit(build.status??1);
