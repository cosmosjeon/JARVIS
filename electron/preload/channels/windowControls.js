const createStateListener = (channel, ipcRenderer) => (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

module.exports = (ipcRenderer) => {
  const windowControls = {
    minimize: () => ipcRenderer.invoke('window:control', 'minimize'),
    maximize: () => ipcRenderer.invoke('window:control', 'maximize'),
    close: () => ipcRenderer.invoke('window:control', 'close'),
    getState: () => ipcRenderer.invoke('window:getState'),
    onStateChange: createStateListener('window:state', ipcRenderer),
  };

  return {
    updateWindowConfig: (config) => ipcRenderer.invoke('window:updateConfig', config),
    toggleWindow: () => ipcRenderer.invoke('window:toggleVisibility'),
    openWidget: (options = {}) => ipcRenderer.invoke('window:openWidget', options),
    setMousePassthrough: (options) => ipcRenderer.invoke('window:setMousePassthrough', options),
    getCursorPosition: () => ipcRenderer.invoke('cursor:getRelativePosition'),
    windowControls,
  };
};
