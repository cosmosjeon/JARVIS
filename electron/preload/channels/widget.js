const createEventListener = (channel, ipcRenderer) => (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

module.exports = (ipcRenderer) => ({
  onPassThroughToggle: createEventListener('pass-through:toggle', ipcRenderer),
  onWidgetSetActiveTree: createEventListener('widget:set-active-tree', ipcRenderer),
});
