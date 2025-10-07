const registerAppEventHandlers = ({
  app,
  handleOAuthDeepLink,
  getLogger,
  getTrayService,
  getOAuthServer,
  ensureMainWindowFocus,
  getMainWindow,
  createMainWindow,
  getLibraryWindow,
  createLibraryWindow,
  settingsManager,
  isDev,
}) => {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleOAuthDeepLink?.(url);
  });

  app.on('browser-window-created', (_, window) => {
    window.setMenuBarVisibility(false);
    getLogger?.()?.info?.('Browser window created');
  });

  app.on('will-quit', () => {
    getTrayService()?.dispose();
    const oauthServer = getOAuthServer();
    const logger = getLogger?.();
    if (oauthServer?.teardown) {
      try {
        oauthServer.teardown();
      } catch (error) {
        logger?.warn?.('auth_callback_server_close_failed', { message: error?.message });
      }
    }
  });

  app.on('window-all-closed', () => {
    getLogger?.()?.info?.('All windows closed');
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
};

module.exports = {
  registerAppEventHandlers,
};
