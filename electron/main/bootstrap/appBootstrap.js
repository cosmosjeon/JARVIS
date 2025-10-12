const { app, ipcMain, nativeTheme, globalShortcut } = require('electron');
const accessibility = require('../../accessibility');
const logs = require('../../logs');
const { createTrayService } = require('../../services/tray-service');
const { LLMService } = require('../../services/llm-service');
const { createLogBridge } = require('../logger');
const {
  createMainWindow,
  createWidgetWindow,
  ensureMainWindowFocus,
  toggleWidgetVisibility,
  getMainWindow,
  getAllWidgetWindows,
  broadcastSettingsToWidgets,
  getWidgetSession,
  resolveBrowserWindowFromSender,
} = require('../app-window');
const { windowConfig, applyWindowConfigTo } = require('../bootstrap/window-state');
const { createLibraryWindow, getLibraryWindow } = require('../library-window');
const { createSettingsManager } = require('../settingsManager');
const { registerDeepLinkScheme, prepareSingleInstance } = require('./deepLink');
const { registerIpcHandlers } = require('./ipc');
const { createOAuthController } = require('./oauth');
const { registerAppEventHandlers } = require('./appEvents');

const start = () => {
  const isDev = !app.isPackaged;
  const pendingOAuthCallbacks = [];

  let logger;
  let llmService;
  let trayService;
  let oauthServer;
  let handleOAuthDeepLinkRef = (url) => {
    if (url) {
      pendingOAuthCallbacks.push(url);
    }
  };

  const settingsManager = createSettingsManager({
    getLogger: () => logger,
    broadcastSettingsToWidgets,
    getLibraryWindow,
  });

  const getFocusWindow = () => {
    const libraryWindow = getLibraryWindow();
    if (libraryWindow && !libraryWindow.isDestroyed()) {
      return libraryWindow;
    }
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      return mainWindow;
    }
    return null;
  };

  const sendOAuthCallback = (url) => {
    if (!url) {
      return;
    }

    const libraryWindow = getLibraryWindow();
    const widgetWindows = getAllWidgetWindows();
    const targets = [];

    if (libraryWindow && !libraryWindow.isDestroyed()) {
      targets.push(libraryWindow);
    }

    widgetWindows.forEach((win) => {
      if (win && !win.isDestroyed()) {
        targets.push(win);
      }
    });

    if (!targets.length) {
      pendingOAuthCallbacks.push(url);
      return;
    }

    targets.forEach((target) => target.webContents.send('auth:oauth-callback', url));

    const focusTarget = getFocusWindow();
    if (focusTarget) {
      focusTarget.show();
      focusTarget.focus();
    }
  };

  registerDeepLinkScheme({ app });

  prepareSingleInstance({
    app,
    getLibraryWindow,
    ensureMainWindowFocus,
    handleOAuthDeepLink: (url) => handleOAuthDeepLinkRef(url),
  });

  registerAppEventHandlers({
    app,
    handleOAuthDeepLink: (url) => handleOAuthDeepLinkRef(url),
    getLogger: () => logger,
    getTrayService: () => trayService,
    getOAuthServer: () => oauthServer,
    ensureMainWindowFocus,
    getMainWindow,
    createMainWindow,
    getLibraryWindow,
    createLibraryWindow,
    settingsManager,
    isDev,
  });

  const onReady = () => {
    nativeTheme.themeSource = 'dark';
    settingsManager.loadSettings();

    logger = createLogBridge(() => getMainWindow());
    llmService = new LLMService({ logger });

    trayService = createTrayService({
      logger,
      toggleWidgetVisibility,
      getMainWindow,
      ensureMainWindowFocus,
      app,
    });

    const oauthController = createOAuthController({
      ipcMain,
      logger,
      settingsManager,
      sendOAuthCallback,
      getFocusWindow,
      pendingOAuthCallbacks,
    });

    oauthServer = oauthController.oauthServer;
    handleOAuthDeepLinkRef = oauthController.handleOAuthDeepLink;

    createLibraryWindow({ isDev, logger });

    const initialDeepLinkArg = process.argv.find((arg) => typeof arg === 'string' && arg.startsWith('jarvis://'));
    if (initialDeepLinkArg) {
      pendingOAuthCallbacks.push(initialDeepLinkArg);
    }

    oauthController.flushPendingCallbacks?.();
    trayService.applyTraySettings(settingsManager.getSettings());
    settingsManager.broadcastSettings();

    registerIpcHandlers({
      ipcMain,
      accessibility,
      logger,
      logs,
      llmService,
      settingsManager,
      trayService,
      createLogBridge,
      isDev,
      toggleWidgetVisibility,
      createMainWindow,
      createWidgetWindow,
      ensureMainWindowFocus,
      getWidgetSession,
      getMainWindow,
      getAllWidgetWindows,
      resolveBrowserWindowFromSender,
      windowConfig,
      applyWindowConfigTo,
      createLibraryWindow,
      getLibraryWindow,
    });

    // 전역 단축키 등록: 플랫폼별 새 위젯 생성
    const isMac = process.platform === 'darwin';
    const widgetShortcut = isMac ? 'Command+`' : 'Alt+`';
    const registered = globalShortcut.register(widgetShortcut, () => {
      try {
        const { window: widgetWindow } = createWidgetWindow({
          logger,
          settings: settingsManager.getSettings(),
          fresh: true,
          isDev,
        });

        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.show();
          widgetWindow.focus();
        }
      } catch (error) {
        logger?.error?.('shortcut_widget_launch_failed', { message: error?.message });
      }
    });

    if (registered) {
      logger?.info?.('global_shortcut_registered', {
        shortcut: widgetShortcut,
        action: 'create_widget',
      });
    } else {
      logger?.warn?.('global_shortcut_registration_failed', { shortcut: widgetShortcut });
    }

    app.on('activate', () => {
      if (!getLibraryWindow()) {
        createLibraryWindow({ isDev, logger });
      }
    });
  };

  app.whenReady().then(onReady).catch((error) => {
    logger?.error?.('app_ready_failed', { message: error?.message });
  });
};

module.exports = {
  start,
};
