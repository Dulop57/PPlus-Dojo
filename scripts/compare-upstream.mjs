import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
// Compare the unmodified upstream frame payload with our exported JSON.
// Run Rukaidata with legacy_renderer=true to embed its JSON in the HTML.
const [dojoPath,upstreamPath,reportPath]=process.argv.slice(2);
if(!dojoPath||!upstreamPath)throw new Error('Usage: node scripts/compare-upstream.mjs <dojo-move.json.gz> <fresh-upstream-move.html[.gz]> [report.json]');
async function read(path){const bytes=await readFile(path);return (path.endsWith('.gz')?gunzipSync(bytes):bytes).toString('utf8');}
const dojo=JSON.parse(await read(dojoPath));
const html=await read(upstreamPath);
const match=html.match(/const fighter_subaction_data = (\{[\s\S]*?\});\s*const fighter_subaction_extent/);
if(!match)throw new Error('Upstream HTML must be freshly generated with legacy_renderer=true from identical source files.');
const upstream=JSON.parse(match[1]);
const frames=dojo.frames.map(({index,...rest})=>rest);
assert.deepEqual(frames,upstream.frames,'Frame geometry, collision values, or state differs from upstream');
for(const field of ['name','iasa','landing_lag','bad_interrupts','animation_flags'])assert.deepEqual(dojo[field],upstream[field],`${field} differs`);
const report={passed:true,move:dojo.moveId,frames:frames.length,upstreamCompared:true,inGameCompared:false,note:'Data payload parity only. Compare screenshots/rendered geometry and in-game timings separately.'};
if(reportPath)await writeFile(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
