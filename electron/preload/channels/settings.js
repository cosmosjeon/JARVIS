const createEventListener = (channel, ipcRenderer) => (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

module.exports = (ipcRenderer) => ({
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (payload) => ipcRenderer.invoke('settings:update', payload),
  onSettings: createEventListener('settings:changed', ipcRenderer),
});
