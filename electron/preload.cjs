const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nudge', {
  load: () => ipcRenderer.invoke('store:load'),
  save: (data) => ipcRenderer.send('store:save', data),
  saveSync: (data) => ipcRenderer.sendSync('store:save-sync', data),
});
