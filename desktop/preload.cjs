const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('dojoDesktop', Object.freeze({
  info: () => ipcRenderer.invoke('desktop:info'),
  checkUpdate: () => ipcRenderer.invoke('desktop:check-update'),
  installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
  onUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('desktop:update', listener);
    return () => ipcRenderer.removeListener('desktop:update', listener);
  },
  beforeClose: (flush) => {
    const listener=async()=>{try{await flush();await ipcRenderer.invoke('desktop:close-ready');}catch{await ipcRenderer.invoke('desktop:close-error');}};
    ipcRenderer.on('desktop:before-close',listener);
    void ipcRenderer.invoke('desktop:close-handler-ready');
    return()=>ipcRenderer.removeListener('desktop:before-close',listener);
  },
}));
