const createStateListener = (channel, ipcRenderer) => (handler) => {
  if (typeof handler !== 'function') {
    return () => { };
  }
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

module.exports = (ipcRenderer) => {
  const windowControls = {
    minimize: () => ipcRenderer.invoke('window:control', 'minimize'),
    maximize: () => ipcRenderer.invoke('window:control', 'maximize'),
    toggleFullScreen: () => ipcRenderer.invoke('window:control', 'toggleFullScreen'),
    close: () => ipcRenderer.invoke('window:control', 'close'),
    getState: () => ipcRenderer.invoke('window:getState'),
    resize: (width, height, animate = true) => ipcRenderer.invoke('window:resize', { width, height, animate }),
    setResizable: (resizable, options = {}) => {
      const payload = { resizable };
      if (typeof options.minWidth === 'number') payload.minWidth = options.minWidth;
      if (typeof options.minHeight === 'number') payload.minHeight = options.minHeight;
      if (typeof options.maxWidth === 'number') payload.maxWidth = options.maxWidth;
      if (typeof options.maxHeight === 'number') payload.maxHeight = options.maxHeight;
      return ipcRenderer.invoke('window:setResizable', payload);
    },
    onStateChange: createStateListener('window:state', ipcRenderer),
  };

  return {
    toggleWindow: () => ipcRenderer.invoke('window:toggleVisibility'),
    openWidget: (options = {}) => ipcRenderer.invoke('window:openWidget', options),
    setMousePassthrough: (options) => ipcRenderer.invoke('window:setMousePassthrough', options),
    windowControls,
  };
};
