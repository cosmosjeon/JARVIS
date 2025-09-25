const path = require('path');
const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const { createLogBridge } = require('./logger');
const { createHotkeyManager } = require('./hotkeys');
const clipboard = require('./clipboard');
const accessibility = require('./accessibility');
const logs = require('./logs');
const settingsStore = require('./settings');
const { createTray } = require('./tray');

const isDev = !app.isPackaged;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let mainWindow;
let logger;
let hotkeyManager;
let tray;

const windowConfig = {
  frameless: false,
  transparent: false,
  alwaysOnTop: false,
  skipTaskbar: false,
};

const DEFAULT_ACCELERATOR = settingsStore.defaultAccelerator;

let settings = { ...settingsStore.defaultSettings };

const ensureWindowFocus = () => {
  if (!mainWindow) {
    return;
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
};

const handleHotkeyTrigger = () => {
  if (!mainWindow) {
    logger?.warn('Hotkey triggered but main window is not available');
    return;
  }

  logger?.info('Primary hotkey triggered');

  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
    logger?.info('Main window hidden via hotkey');
    return;
  }

  ensureWindowFocus();

  const result = clipboard.getText();
  if (result.success) {
    mainWindow.webContents.send('widget:showFromClipboard', {
      text: result.text,
      source: 'clipboard',
      timestamp: Date.now(),
    });
    logger?.info('Clipboard text dispatched to renderer', {
      length: result.text.length,
    });
  } else {
    logger?.warn('Clipboard read failed', result.error);
    mainWindow.webContents.send('widget:clipboardError', {
      error: result.error,
      timestamp: Date.now(),
    });
  }
};

const registerPrimaryHotkey = () => {
  if (!hotkeyManager) {
    hotkeyManager = createHotkeyManager(logger);
  }
  hotkeyManager.unregisterAll?.();

  const accelerator = typeof settings.accelerator === 'string' && settings.accelerator.trim()
    ? settings.accelerator.trim()
    : DEFAULT_ACCELERATOR;
  const options = {};
  if (process.platform === 'win32' && settings.doubleCtrlEnabled) {
    options.enableDoubleCtrl = true;
  }
  const success = hotkeyManager.registerToggle({ accelerator, handler: handleHotkeyTrigger, options });
  if (success) {
    logger?.info('Primary hotkey registered', { accelerator, doubleCtrl: options.enableDoubleCtrl || false });
  } else {
    logger?.warn('Primary hotkey registration failed', { accelerator, doubleCtrl: options.enableDoubleCtrl || false });
  }
  return success;
};

const loadSettings = () => {
  settings = {
    ...settingsStore.defaultSettings,
    ...settingsStore.readSettings(),
  };
};

const persistSettings = () => {
  const success = settingsStore.writeSettings(settings);
  if (!success) {
    logger?.warn('Failed to persist settings');
  }
};

const applyHotkeySettings = () => {
  if (!logger) return;
  registerPrimaryHotkey();
};

const applyTraySettings = () => {
  if (!logger) return;
  if (settings.trayEnabled) {
    if (!tray) {
      tray = createTray({
        getWindow: () => mainWindow,
        onToggle: () => handleHotkeyTrigger(),
        onShowSettings: () => {
          logger?.info('Settings placeholder invoked from tray');
          ensureWindowFocus();
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

const broadcastSettings = () => {
  if (!mainWindow) return;
  mainWindow.webContents.send('settings:changed', { ...settings });
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 520,
    minHeight: 360,
    show: false,
    title: 'JARVIS Widget',
    backgroundColor: '#111827',
    autoHideMenuBar: true,
    frame: !windowConfig.frameless,
    transparent: windowConfig.transparent,
    alwaysOnTop: windowConfig.alwaysOnTop,
    skipTaskbar: windowConfig.skipTaskbar,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    logger?.info('Main window ready');
  });

  mainWindow.on('closed', () => {
    logger?.info('Main window closed');
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const startUrl = isDev
    ? process.env.ELECTRON_START_URL || 'http://localhost:3000'
    : `file://${path.join(__dirname, '..', 'build', 'index.html')}`;

  logger?.info('Loading URL', { startUrl });
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastSettings();
  });
};

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  loadSettings();
  logger = createLogBridge(() => mainWindow);
  createWindow();
  applyHotkeySettings();
  applyTraySettings();
  broadcastSettings();
  ipcMain.handle('system:ping', () => 'pong');
  ipcMain.handle('logger:write', (_event, payload) => {
    const { level = 'info', message = '', meta = {} } = payload || {};
    if (!message) {
      return { success: false, error: { code: 'invalid_log', message: 'message required' } };
    }
    const normalizedMeta = typeof meta === 'object' && meta !== null ? meta : {};
    const bridge = logger || createLogBridge(() => mainWindow);
    if (typeof bridge[level] === 'function') {
      bridge[level](message, normalizedMeta);
    } else {
      bridge.info(message, normalizedMeta);
    }
    return { success: true };
  });

  ipcMain.handle('system:accessibility:check', () => ({
    success: true,
    granted: accessibility.checkAccessibilityPermission(),
  }));

  ipcMain.handle('system:accessibility:request', () => {
    const result = accessibility.requestAccessibilityPermission();
    return { success: result.granted, ...result };
  });

  ipcMain.handle('logs:export', (_event, payload = {}) => logs.exportLogs(payload));

  ipcMain.handle('settings:get', () => ({ success: true, settings: { ...settings } }));

  ipcMain.handle('settings:update', (_event, payload = {}) => {
    let changed = false;

    if (typeof payload.doubleCtrlEnabled === 'boolean' && payload.doubleCtrlEnabled !== settings.doubleCtrlEnabled) {
      settings.doubleCtrlEnabled = payload.doubleCtrlEnabled;
      applyHotkeySettings();
      changed = true;
    }

    if (typeof payload.autoPasteEnabled === 'boolean' && payload.autoPasteEnabled !== settings.autoPasteEnabled) {
      settings.autoPasteEnabled = payload.autoPasteEnabled;
      changed = true;
    }

    if (typeof payload.trayEnabled === 'boolean' && payload.trayEnabled !== settings.trayEnabled) {
      settings.trayEnabled = payload.trayEnabled;
      applyTraySettings();
      changed = true;
    }

    if (typeof payload.accelerator === 'string') {
      const normalized = payload.accelerator.trim();
      if (normalized && normalized !== settings.accelerator) {
        settings.accelerator = normalized;
        applyHotkeySettings();
        changed = true;
      }
    } else if (payload.accelerator === null) {
      if (settings.accelerator !== DEFAULT_ACCELERATOR) {
        settings.accelerator = DEFAULT_ACCELERATOR;
        applyHotkeySettings();
        changed = true;
      }
    }

    if (changed) {
      persistSettings();
      broadcastSettings();
    }

    return { success: true, settings: { ...settings } };
  });

  ipcMain.handle('window:toggleVisibility', () => {
    if (!mainWindow) {
      return { success: false, error: { code: 'no_window', message: 'Main window not available' } };
    }
    if (!mainWindow.isVisible()) {
      ensureWindowFocus();
      return { success: true, visible: true };
    }
    if (mainWindow.isFocused()) {
      mainWindow.hide();
      logger?.info('Main window hidden via IPC');
      return { success: true, visible: false };
    }
    ensureWindowFocus();
    return { success: true, visible: true };
  });

  ipcMain.handle('window:updateConfig', (_event, config = {}) => {
    Object.assign(windowConfig, {
      frameless: Boolean(config.frameless),
      transparent: Boolean(config.transparent),
      alwaysOnTop: Boolean(config.alwaysOnTop),
      skipTaskbar: Boolean(config.skipTaskbar),
    });

    if (!mainWindow) return windowConfig;

    mainWindow.setAlwaysOnTop(windowConfig.alwaysOnTop, 'floating', 1);
    mainWindow.setSkipTaskbar(windowConfig.skipTaskbar);

    if (windowConfig.frameless !== mainWindow.isFrameless()) {
      mainWindow.setMenuBarVisibility(!windowConfig.frameless);
    }

    logger?.info('Window config updated', windowConfig);
    return windowConfig;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('browser-window-created', (_, window) => {
  window.setMenuBarVisibility(false);
  logger?.info('Browser window created');
});

app.on('will-quit', () => {
  hotkeyManager?.dispose?.();
  tray?.dispose?.();
});

app.on('window-all-closed', () => {
  logger?.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
