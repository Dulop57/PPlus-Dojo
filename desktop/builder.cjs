const fs = require('node:fs');
const config = fs.existsSync('desktop.config.json') ? JSON.parse(fs.readFileSync('desktop.config.json','utf8')) : {};
if(config.releaseRepository && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.releaseRepository)) throw new Error('releaseRepository must be owner/repository');
const [owner,repo] = (config.releaseRepository||'').split('/');
module.exports = {
  appId:'org.pplusdojo.desktop',productName:'P+ Dojo',directories:{app:'desktop',output:'artifacts/desktop'},
  files:['main.cjs','preload.cjs','paths.cjs','icon.ico','package.json',{from:'../dist',to:'dist',filter:['**/*']}],
  extraResources:[{from:'desktop.config.json',to:'desktop.config.json'}],
  asar:true,win:{icon:'desktop/icon.ico',target:[{target:'nsis',arch:['x64']}],artifactName:'PPlus-Dojo-Setup-${version}.${ext}'},
  nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,createDesktopShortcut:true,deleteAppDataOnUninstall:false},
  publish:repo?[{provider:'github',owner,repo,releaseType:'release'}]:null,
};
