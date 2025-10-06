const path = require('path');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('[electron] Failed to load .env file:', error?.message);
}

const { app, ipcMain, nativeTheme, screen, globalShortcut } = require('electron');
const { createLogBridge } = require('./logger');
const { createHotkeyManager } = require('../hotkeys');
const accessibility = require('../accessibility');
const logs = require('../logs');
const settingsStoreModule = require('./settings');
const { createTray } = require('../tray');
const { LLMService } = require('../services/llm-service');
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
} = require('./app-window');
const { windowConfig, applyWindowConfigTo } = require('./bootstrap/window-state');
const { createLibraryWindow, getLibraryWindow } = require('./library-window');
const {
  ensureAdminPanelWindow,
  closeAdminPanelWindow,
  getAdminPanelWindow,
  positionAdminPanelWindow,
} = require('./admin-panel');
const { createOAuthServer, createOAuthHandlers } = require('./auth');
const { registerSystemHandlers } = require('./ipc-handlers/system');
const { registerLogHandlers } = require('./ipc-handlers/logs');
const { registerAgentHandlers } = require('./ipc-handlers/agent');
const { registerSettingsHandlers } = require('./ipc-handlers/settings');
const { registerWindowHandlers } = require('./ipc-handlers/window');
const { registerLibraryHandlers } = require('./ipc-handlers/library');
const { registerAdminHandlers } = require('./ipc-handlers/admin');

const isDev = !app.isPackaged;

let logger;
let hotkeyManager;
let tray;
let llmService;
const settingsStore = settingsStoreModule.createSettingsStore();

let settings = settingsStore.get();
let oauthServer;
let handleOAuthDeepLink;

const pendingOAuthCallbacks = [];

const DEFAULT_ACCELERATOR = settingsStoreModule.DEFAULT_ACCELERATOR;

const loadSettings = () => {
  settings = {
    ...settingsStoreModule.defaultSettings,
    ...settingsStoreModule.readSettings(),
  };
};

const persistSettings = () => {
  const success = settingsStore.persist();
  if (!success) {
    logger?.warn?.('Failed to persist settings');
  }
};

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

const broadcastSettingsToAllWindows = () => {
  broadcastSettingsToWidgets(settings);
  const libraryWindow = getLibraryWindow();
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    libraryWindow.webContents.send('settings:changed', { ...settings });
  }
};

const registerPrimaryHotkey = () => {
  if (!hotkeyManager) {
    hotkeyManager = createHotkeyManager(logger);
  }
  hotkeyManager.unregisterAll?.();
  logger?.info?.('Primary hotkey registration disabled - Alt+` key removed');
  return true;
};

const toggleWidgetWindows = () => {
  const result = toggleWidgetVisibility(logger);
  return result.visible;
};

const registerWidgetToggleHotkey = () => {
  if (!hotkeyManager) {
    hotkeyManager = createHotkeyManager(logger);
    logger?.info?.('Hotkey manager created for widget toggle');
  }

  logger?.info?.('Attempting to register Alt+1 hotkey for widget toggle');

  const success = hotkeyManager.registerToggle({
    accelerator: 'Alt+1',
    handler: toggleWidgetWindows,
  });

  if (success) {
    logger?.info?.('Widget toggle hotkey registered successfully', {
      accelerator: 'Alt+1',
      platform: process.platform,
      hotkeyManagerStatus: hotkeyManager.status,
    });
  } else {
    logger?.error?.('Widget toggle hotkey registration failed', {
      accelerator: 'Alt+1',
      platform: process.platform,
      hotkeyManagerStatus: hotkeyManager.status,
    });

    logger?.info?.('Attempting direct globalShortcut registration as fallback');
    const directSuccess = globalShortcut.register('Alt+1', toggleWidgetWindows);
    if (directSuccess) {
      logger?.info?.('Direct globalShortcut registration successful');
    } else {
      logger?.error?.('Direct globalShortcut registration also failed');
    }
  }

  return success;
};

const registerPassThroughShortcut = () => {
  const accelerator = 'CommandOrControl+2';
  const success = globalShortcut.register(accelerator, () => {
    ensureMainWindowFocus();
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send('pass-through:toggle');
  });

  if (success) {
    logger?.info?.('Pass-through shortcut registered', { accelerator });
  } else {
    logger?.warn?.('Failed to register pass-through shortcut', { accelerator });
  }
};

const applyHotkeySettings = () => {
  if (!logger) {
    return;
  }
  registerPrimaryHotkey();
  registerWidgetToggleHotkey();
};

const toggleFromTray = () => {
  const visible = toggleWidgetWindows();
  return { visible };
};

const applyTraySettings = () => {
  if (!logger) {
    return;
  }

  if (settings.trayEnabled) {
    if (!tray) {
      tray = createTray({
        getWindow: () => getMainWindow(),
        onToggle: toggleFromTray,
        onShowSettings: () => {
          logger?.info?.('Settings placeholder invoked from tray');
          ensureMainWindowFocus();
        },
        onQuit: () => app.quit(),
        logger,
      });
    }
    tray.create();
    tray.updateMenu();
  } else if (tray) {
    tray.dispose();
    tray = null;
  }
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

const handleSecondInstance = (_event, argv) => {
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

const registerDeepLinkScheme = () => {
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
    const resource = process.argv[1] ? path.resolve(process.argv[1]) : path.join(__dirname, '..', 'main.js');
    app.setAsDefaultProtocolClient('jarvis', executable, ['--', resource]);
  } else {
    app.setAsDefaultProtocolClient('jarvis');
  }
};

const prepareSingleInstance = () => {
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    app.quit();
  }

  app.on('second-instance', handleSecondInstance);
};


const registerIpcHandlers = () => {
  registerSystemHandlers({ ipcMain, accessibility });

  registerLogHandlers({
    ipcMain,
    logger,
    createLogBridge,
    getMainWindow,
    logs,
  });

  registerAgentHandlers({ ipcMain, llmService, logger });

  registerSettingsHandlers({
    ipcMain,
    getSettings: () => settings,
    setSettings: (next) => { settings = next; },
    applyHotkeySettings,
    applyTraySettings,
    persistSettings,
    broadcastSettings: broadcastSettingsToAllWindows,
    defaultAccelerator: DEFAULT_ACCELERATOR,
  });

  registerWindowHandlers({
    ipcMain,
    screen,
    logger,
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
    getSettings: () => settings,
  });

  registerLibraryHandlers({
    ipcMain,
    createLibraryWindow,
    getLibraryWindow,
    logger,
    isDev,
  });

  registerAdminHandlers({
    ipcMain,
    ensureAdminPanelWindow,
    closeAdminPanelWindow,
    screen,
    isDev,
    logger,
  });
};

const initializeOAuth = () => {
  oauthServer = createOAuthServer({
    logger,
    settings,
    sendOAuthCallback,
    getFocusWindow,
  });

  const { ensureAuthCallbackServer, handleOAuthDeepLink: deepLinkHandler } = oauthServer;
  const oauthHandlers = createOAuthHandlers({
    ipcMain,
    logger,
    ensureAuthCallbackServer,
    handleOAuthDeepLink: deepLinkHandler,
    pendingOAuthCallbacks,
    getFocusWindow,
  });

  handleOAuthDeepLink = oauthHandlers.handleOAuthDeepLink;
  return oauthHandlers;
};

const onAppReady = () => {
  registerDeepLinkScheme();

  nativeTheme.themeSource = 'dark';
  loadSettings();

  logger = createLogBridge(() => getMainWindow());
  llmService = new LLMService({ logger });

  const oauthHandlers = initializeOAuth();

  createLibraryWindow({ isDev, logger });

  const initialDeepLinkArg = process.argv.find((arg) => typeof arg === 'string' && arg.startsWith('jarvis://'));
  if (initialDeepLinkArg) {
    pendingOAuthCallbacks.push(initialDeepLinkArg);
  }

  oauthHandlers.flushPendingCallbacks();
  applyHotkeySettings();
  applyTraySettings();
  registerPassThroughShortcut();
  broadcastSettingsToAllWindows();

  try {
    screen.on?.('display-metrics-changed', () => {
      const panel = getAdminPanelWindow();
      if (!panel || panel.isDestroyed()) {
        return;
      }
      positionAdminPanelWindow(panel, screen, logger);
    });
  } catch (error) {
    logger?.warn?.('admin_panel_screen_listener_failed', { message: error?.message });
  }

  registerIpcHandlers();

  app.on('activate', () => {
    const existingMain = getMainWindow();
    if (!existingMain) {
      createMainWindow({ logger, settings, isDev });
    }
    if (!getLibraryWindow()) {
      createLibraryWindow({ isDev, logger });
    }
  });
};

const registerAppEventHandlers = () => {
  prepareSingleInstance();

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleOAuthDeepLink?.(url);
  });

  app.on('browser-window-created', (_, window) => {
    window.setMenuBarVisibility(false);
    logger?.info?.('Browser window created');
  });

  app.on('will-quit', () => {
    globalShortcut.unregister('CommandOrControl+2');
    globalShortcut.unregister('Alt+1');
    hotkeyManager?.dispose?.();
    tray?.dispose?.();
    if (oauthServer?.teardown) {
      try {
        oauthServer.teardown();
      } catch (error) {
        logger?.warn?.('auth_callback_server_close_failed', { message: error?.message });
      }
    }
  });

  app.on('window-all-closed', () => {
    logger?.info?.('All windows closed');
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
};

const start = () => {
  registerAppEventHandlers();
  app.whenReady().then(onAppReady).catch((error) => {
    logger?.error?.('app_ready_failed', { message: error?.message });
  });
};

module.exports = {
  start,
};

start();
