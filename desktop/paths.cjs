const path = require('node:path');
const fs = require('node:fs/promises');
async function resolveAsset(root, requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== 'dojo:' || url.hostname !== 'app') throw new Error('Invalid app origin');
  const name = decodeURIComponent(url.pathname);
  if (name.includes('\\') || name.includes('\0') || name.includes(':') || name.split('/').includes('..')) throw new Error('Invalid asset path');
  const base = await fs.realpath(root);
  const file = await fs.realpath(path.join(base, name === '/' ? 'index.html' : name));
  if (!file.startsWith(base + path.sep) || !(await fs.stat(file)).isFile()) throw new Error('Asset outside app');
  return file;
}
module.exports = {resolveAsset};
