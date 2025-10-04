const createEventListener = (channel, ipcRenderer) => (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

module.exports = (ipcRenderer) => ({
  log: (level, message, meta) => ipcRenderer.invoke('logger:write', { level, message, meta }),
  onLog: createEventListener('app:log', ipcRenderer),
  exportLogs: (options) => ipcRenderer.invoke('logs:export', options),
});
