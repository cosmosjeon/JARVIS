const createEventListener = (channel, ipcRenderer) => (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

module.exports = (ipcRenderer) => ({
  requestCapture: () => ipcRenderer.invoke('capture-area:request'),
  performCapture: (payload) => ipcRenderer.invoke('capture-area:perform', payload),
  cancelCapture: () => ipcRenderer.invoke('capture-area:cancel'),
  onCaptureStarted: createEventListener('capture-area:started', ipcRenderer),
  onCaptureCompleted: createEventListener('capture-area:completed', ipcRenderer),
  onCaptureCancelled: createEventListener('capture-area:cancelled', ipcRenderer),
  onCaptureFailed: createEventListener('capture-area:failed', ipcRenderer),
});
