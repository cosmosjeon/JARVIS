const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvisAPI', {
  ping: () => ipcRenderer.invoke('system:ping'),
  updateWindowConfig: (config) => ipcRenderer.invoke('window:updateConfig', config),
  toggleWindow: () => ipcRenderer.invoke('window:toggleVisibility'),
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:control', 'minimize'),
    maximize: () => ipcRenderer.invoke('window:control', 'maximize'),
    close: () => ipcRenderer.invoke('window:control', 'close'),
    getState: () => ipcRenderer.invoke('window:getState'),
    onStateChange: (handler) => {
      if (typeof handler !== 'function') {
        return () => {};
      }
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on('window:state', listener);
      return () => ipcRenderer.removeListener('window:state', listener);
    },
  },
  setMousePassthrough: (options) => ipcRenderer.invoke('window:setMousePassthrough', options),
  getCursorPosition: () => ipcRenderer.invoke('cursor:getRelativePosition'),
  checkAccessibilityPermission: () => ipcRenderer.invoke('system:accessibility:check'),
  requestAccessibilityPermission: () => ipcRenderer.invoke('system:accessibility:request'),
  exportLogs: (options) => ipcRenderer.invoke('logs:export', options),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (payload) => ipcRenderer.invoke('settings:update', payload),
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
  onClipboardError: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('widget:clipboardError', listener);
    return () => ipcRenderer.removeListener('widget:clipboardError', listener);
  },
  onTrayCommand: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('tray:command', listener);
    return () => ipcRenderer.removeListener('tray:command', listener);
  },
  onSettings: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('settings:changed', listener);
    return () => ipcRenderer.removeListener('settings:changed', listener);
  },
  onPassThroughToggle: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = () => handler();
    ipcRenderer.on('pass-through:toggle', listener);
    return () => ipcRenderer.removeListener('pass-through:toggle', listener);
  },
});
