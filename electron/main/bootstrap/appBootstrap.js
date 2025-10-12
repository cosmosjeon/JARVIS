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
  let lastOpenedTreeId = null;

  const setLastOpenedTreeId = (treeId, context = {}) => {
    if (typeof treeId !== 'string') {
      return;
    }
    const normalized = treeId.trim();
    if (!normalized) {
      return;
    }
    lastOpenedTreeId = normalized;
    logger?.debug?.('last_tree_updated', {
      treeId: normalized,
      source: context?.source || 'unknown',
    });
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
      onWidgetOpened: ({ treeId, source }) => setLastOpenedTreeId(treeId, { source }),
    });

    // 전역 단축키 등록
    const isMac = process.platform === 'darwin';
    const createWidgetShortcut = isMac ? 'Command+`' : 'Alt+`';
    const createWidgetShortcutRegistered = globalShortcut.register(createWidgetShortcut, () => {
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

    if (createWidgetShortcutRegistered) {
      logger?.info?.('global_shortcut_registered', {
        shortcut: createWidgetShortcut,
        action: 'create_widget',
      });
    } else {
      logger?.warn?.('global_shortcut_registration_failed', { shortcut: createWidgetShortcut });
    }

    const openRecentTreeWidget = () => {
      const recentTreeId = lastOpenedTreeId;
      if (!recentTreeId) {
        logger?.warn?.('recent_widget_shortcut_missing_tree');
        return;
      }

      try {
        const settings = settingsManager.getSettings();
        const { window: primaryWindow } = createMainWindow({
          logger,
          settings,
          treeId: recentTreeId,
          fresh: false,
          isDev,
        });

        if (!primaryWindow || primaryWindow.isDestroyed()) {
          logger?.warn?.('recent_widget_launch_failed', {
            treeId: recentTreeId,
            reason: 'window_unavailable',
          });
          return;
        }

        ensureMainWindowFocus();
        primaryWindow.webContents.send('widget:set-active-tree', { treeId: recentTreeId });
        setLastOpenedTreeId(recentTreeId, { source: 'shortcut:recent' });
      } catch (error) {
        logger?.error?.('recent_widget_launch_failed', {
          message: error?.message,
          treeId: recentTreeId,
        });
      }
    };

    const recentTreeShortcut = isMac ? 'Command+1' : 'Alt+1';
    const recentTreeShortcutRegistered = globalShortcut.register(recentTreeShortcut, openRecentTreeWidget);

    if (recentTreeShortcutRegistered) {
      logger?.info?.('global_shortcut_registered', {
        shortcut: recentTreeShortcut,
        action: 'open_recent_tree',
      });
    } else {
      logger?.warn?.('global_shortcut_registration_failed', { shortcut: recentTreeShortcut });
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
