const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nudge', {
  load: (space) => ipcRenderer.invoke('store:load', space),
  save: (space, data) => ipcRenderer.send('store:save', space, data),
  saveSync: (space, data) => ipcRenderer.sendSync('store:save-sync', space, data),
  authGet: () => ipcRenderer.invoke('auth:get'),
  authSet: (cred) => ipcRenderer.invoke('auth:set', cred),
});
