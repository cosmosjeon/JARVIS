const createEventListener = (channel, ipcRenderer) => (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

module.exports = (ipcRenderer) => ({
  onOAuthCallback: createEventListener('auth:oauth-callback', ipcRenderer),
  getOAuthRedirect: (options) => ipcRenderer.invoke('auth:get-callback-url', options),
  launchOAuth: (url) => ipcRenderer.invoke('auth:launch-oauth', { url }),
});
