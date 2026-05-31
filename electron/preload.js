const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eMessengerDesktop', {
  isDesktop: true,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('window-state', listener);
    return () => ipcRenderer.removeListener('window-state', listener);
  },
});
