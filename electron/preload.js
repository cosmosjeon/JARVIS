const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvisAPI', {
  ping: () => ipcRenderer.invoke('system:ping'),
  updateWindowConfig: (config) => ipcRenderer.invoke('window:updateConfig', config),
  log: (level, message, meta) => ipcRenderer.invoke('logger:write', { level, message, meta }),
  onLog: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('app:log', listener);
    return () => ipcRenderer.removeListener('app:log', listener);
  },
  onClipboard: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('widget:showFromClipboard', listener);
    return () => ipcRenderer.removeListener('widget:showFromClipboard', listener);
  },
});
