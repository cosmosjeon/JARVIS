const createEventListener = (channel, ipcRenderer, mapPayload = (payload) => payload) => (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const listener = (_event, payload) => handler(mapPayload(payload));
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

module.exports = (ipcRenderer) => ({
  showLibrary: () => ipcRenderer.invoke('library:show'),
  requestLibraryRefresh: () => ipcRenderer.invoke('library:request-refresh'),
  onLibraryRefresh: createEventListener('library:refresh', ipcRenderer, () => undefined),
});
