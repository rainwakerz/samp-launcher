const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
    onMaximizeChange: (cb) =>
      ipcRenderer.on('window:maximized', (_e, val) => cb(val)),
  },
  dialog: {
    pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  },
  launch: (data) => ipcRenderer.invoke('launch:samp', data),
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (data) => ipcRenderer.invoke('settings:save', data),
  },
  servers: {
    load: () => ipcRenderer.invoke('servers:load'),
    save: (list) => ipcRenderer.invoke('servers:save', list),
  }
});