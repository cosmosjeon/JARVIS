const path = require('path');

const registerDeepLinkScheme = ({ app }) => {
  if (process.platform === 'win32') {
    if (process.defaultApp) {
      app.setAsDefaultProtocolClient('jarvis', process.execPath, [path.resolve(process.argv[1] || '.')]);
    } else {
      app.setAsDefaultProtocolClient('jarvis');
    }
    return;
  }

  if (process.defaultApp) {
    const executable = process.execPath;
    const resource = process.argv[1] ? path.resolve(process.argv[1]) : path.join(__dirname, '..', '..', 'main.js');
    app.setAsDefaultProtocolClient('jarvis', executable, ['--', resource]);
  } else {
    app.setAsDefaultProtocolClient('jarvis');
  }
};

const createSecondInstanceHandler = ({ getLibraryWindow, ensureMainWindowFocus, handleOAuthDeepLink }) => (_event, argv) => {
  const deepLinkArg = argv.find((arg) => typeof arg === 'string' && arg.startsWith('jarvis://'));
  if (deepLinkArg) {
    handleOAuthDeepLink?.(deepLinkArg);
  }

  const libraryWindow = getLibraryWindow();
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    if (libraryWindow.isMinimized()) {
      libraryWindow.restore();
    }
    libraryWindow.show();
    libraryWindow.focus();
    return;
  }

  ensureMainWindowFocus();
};

const prepareSingleInstance = ({ app, ...rest }) => {
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    app.quit();
  }

  const secondInstanceHandler = createSecondInstanceHandler(rest);
  app.on('second-instance', secondInstanceHandler);
  return secondInstanceHandler;
};

module.exports = {
  registerDeepLinkScheme,
  prepareSingleInstance,
};
