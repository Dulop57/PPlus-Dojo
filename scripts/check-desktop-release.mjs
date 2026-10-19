import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';

const metadata=JSON.parse(await readFile('package.json','utf8'));
const config=JSON.parse(await readFile('desktop.config.json','utf8'));
assert.ok(config.releaseRepository,'Configure a release repository first.');
// Use the same YAML parser shipped with the updater runtime.
const taskRequire=createRequire(resolve('desktop/node_modules/electron-updater/package.json'));
const yaml=taskRequire('js-yaml'),folder=resolve('artifacts/desktop');
const filename=`PPlus-Dojo-Setup-${metadata.version}.exe`;
const latest=yaml.load(await readFile(join(folder,'latest.yml'),'utf8'));
assert.equal(latest.version,metadata.version,'Updater version differs from the app.');
assert.equal(latest.path,filename);assert.equal(latest.files.length,1);assert.equal(latest.files[0].url,filename);
assert.equal(latest.files[0].size,(await stat(join(folder,filename))).size);
const hash=createHash('sha512');for await(const chunk of createReadStream(join(folder,filename)))hash.update(chunk);
const checksum=hash.digest('base64');assert.equal(latest.sha512,checksum);assert.equal(latest.files[0].sha512,checksum);
assert.ok((await stat(join(folder,filename+'.blockmap'))).size>0,'Installer blockmap is missing.');
const resources=resolve(folder,'win-unpacked/resources');
assert.deepEqual(JSON.parse(await readFile(join(resources,'desktop.config.json'),'utf8')),config);
const updater=yaml.load(await readFile(join(resources,'app-update.yml'),'utf8'));
assert.equal(updater.provider,'github');assert.equal(`${updater.owner}/${updater.repo}`,config.releaseRepository);
assert.ok(updater.updaterCacheDirName);
console.log(`Release ${metadata.version} verified: installer size and SHA-512, blockmap, Firebase settings, and GitHub updater configuration. Upload ${filename}, ${filename}.blockmap, and latest.yml together.`);
