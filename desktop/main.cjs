const {app, BrowserWindow, protocol, net, ipcMain, shell, session, Menu, dialog} = require('electron');
const {autoUpdater} = require('electron-updater');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const {resolveAsset} = require('./paths.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'dojo', privileges:{standard:true, secure:true, supportFetchAPI:true, stream:true}}]);
app.setName('P+ Dojo');
// Opt-in preload uses packed geometry, but still needs more than Chromium's default heap.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=6144');
if (!app.requestSingleInstanceLock()) app.quit();
let window, updateState = {status:'unconfigured'}, checking = false, allowClose=false, closeRequested=false, canFlush=false;
const root = path.join(app.getAppPath(),'dist');
const configPath = app.isPackaged ? path.join(process.resourcesPath,'desktop.config.json') : path.join(__dirname,'../desktop.config.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath,'utf8')) : {};
const repo = typeof config.releaseRepository === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.releaseRepository) ? config.releaseRepository : null;
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; worker-src 'self' blob:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com; object-src 'none'; base-uri 'self'; frame-src 'none'";
function publish(state) { updateState = state; if (window && !window.isDestroyed()) window.webContents.send('desktop:update',state); }
function authorized(event) { if (event.sender !== window?.webContents || !event.senderFrame?.url.startsWith('dojo://app/')) throw new Error('Untrusted app request'); }
async function checkUpdates() {
  if (!repo || !app.isPackaged) return updateState;
  if (checking || ['downloading','ready'].includes(updateState.status)) return updateState;
  checking = true;
  try { await autoUpdater.checkForUpdates(); }
  catch { publish({status:'error',message:'Could not check for updates. Your installed app still works offline.'}); }
  finally { checking = false; }
  return updateState;
}
function configureUpdater() {
  if (!app.isPackaged) { publish({status:'development'}); return; }
  if (!repo) return;
  const [owner, repository] = repo.split('/');
  autoUpdater.setFeedURL({provider:'github',owner,repo:repository,private:false});
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('checking-for-update',()=>publish({status:'checking'}));
  autoUpdater.on('update-not-available',()=>publish({status:'current'}));
  autoUpdater.on('update-available',info=>publish({status:'downloading',version:info.version,percent:0}));
  autoUpdater.on('download-progress',progress=>publish({...updateState,status:'downloading',percent:Math.round(progress.percent)}));
  autoUpdater.on('update-downloaded',info=>publish({status:'ready',version:info.version}));
  autoUpdater.on('error',()=>publish({status:'error',message:'Update unavailable. Try again when connected.'}));
  setTimeout(()=>void checkUpdates(),15000);
  setInterval(()=>void checkUpdates(),4*60*60*1000).unref();
}
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
app.whenReady().then(async()=>{
  protocol.handle('dojo',async request=>{
    try {
      if (!['GET','HEAD'].includes(request.method)) return new Response('Read-only app',{status:405});
      const file = await resolveAsset(root,request.url);
      const response = await net.fetch(pathToFileURL(file).href);
      const headers=new Headers(response.headers);
      headers.set('Content-Security-Policy',csp);
      headers.set('X-Content-Type-Options','nosniff');
      return new Response(response.body,{status:response.status,headers});
    } catch { return new Response('App file missing. Reinstall P+ Dojo.',{status:404}); }
  });
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  ipcMain.handle('desktop:info',event=>{authorized(event);return {version:app.getVersion(),firebase:config.firebase??null,releaseRepository:repo,update:updateState,skipPreload:process.argv.includes('--no-preload')};});
  ipcMain.handle('desktop:check-update',async event=>{authorized(event);return checkUpdates();});
  ipcMain.handle('desktop:install-update',event=>{authorized(event);if(updateState.status!=='ready')throw new Error('No downloaded update');allowClose=true;setImmediate(()=>autoUpdater.quitAndInstall(false,true));});
  ipcMain.handle('desktop:close-ready',event=>{authorized(event);allowClose=true;window.close();});
  ipcMain.handle('desktop:close-handler-ready',event=>{authorized(event);canFlush=true;if(closeRequested)window.webContents.send('desktop:before-close');});
  ipcMain.handle('desktop:close-error',async event=>{authorized(event);const result=await dialog.showMessageBox(window,{type:'error',message:'Study records could not finish saving.',detail:'Keep the app open to retry, or close anyway.',buttons:['Keep app open','Close anyway'],defaultId:0,cancelId:0});closeRequested=false;if(result.response===1){allowClose=true;window.close();}});
  window = new BrowserWindow({title:'P+ Dojo',icon:path.join(__dirname,'icon.ico'),width:1440,height:960,minWidth:900,minHeight:620,backgroundColor:'#10151b',show:false,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  Menu.setApplicationMenu(null);
  const openExternal = url=>{try{const parsed=new URL(url);if(parsed.protocol==='https:'||parsed.protocol==='http:')void shell.openExternal(parsed.href);}catch{}};
  window.webContents.setWindowOpenHandler(({url})=>{openExternal(url);return {action:'deny'};});
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==new URL('dojo://app/').origin || !url.startsWith('dojo://app/')){event.preventDefault();openExternal(url);}});
  window.on('close',event=>{if(canFlush&&!allowClose&&!window.webContents.isDestroyed()){event.preventDefault();if(!closeRequested){closeRequested=true;window.webContents.send('desktop:before-close');}}});
  window.once('ready-to-show',()=>{if(process.env.DOJO_DESKTOP_TEST!=='1')window.show();});
  configureUpdater();
  await window.loadURL('dojo://app/');
}).catch(error=>{console.error('P+ Dojo could not start:',error);app.quit();});
app.on('window-all-closed',()=>app.quit());
