const { createOAuthServer, createOAuthHandlers } = require('../auth');

const createOAuthController = ({
  ipcMain,
  logger,
  settingsManager,
  sendOAuthCallback,
  getFocusWindow,
  pendingOAuthCallbacks,
}) => {
  const oauthServer = createOAuthServer({
    logger,
    settings: settingsManager.getSettings(),
    sendOAuthCallback,
    getFocusWindow,
  });

  const oauthHandlers = createOAuthHandlers({
    ipcMain,
    logger,
    ensureAuthCallbackServer: oauthServer.ensureAuthCallbackServer,
    handleOAuthDeepLink: oauthServer.handleOAuthDeepLink,
    pendingOAuthCallbacks,
    getFocusWindow,
  });

  return {
    oauthServer,
    handleOAuthDeepLink: oauthHandlers.handleOAuthDeepLink,
    flushPendingCallbacks: oauthHandlers.flushPendingCallbacks,
  };
};

module.exports = {
  createOAuthController,
};
