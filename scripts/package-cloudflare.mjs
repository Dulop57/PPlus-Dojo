import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {checkCloudflare} from './build-cloudflare.mjs';
import {zipDirectory} from './zip-directory.mjs';
const output=resolve('dist-web');await checkCloudflare(output);await mkdir('artifacts',{recursive:true});
const archive=join(resolve('artifacts'),'PPlus-Dojo-Cloudflare.zip');await zipDirectory(output,archive);console.log(`Cloudflare dashboard upload: ${archive}`);
