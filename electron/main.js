const path = require('path');
const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const { createLogBridge } = require('./logger');
const { createHotkeyManager } = require('./hotkeys');
const clipboard = require('./clipboard');

const isDev = !app.isPackaged;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let mainWindow;
let logger;
let hotkeyManager;

const windowConfig = {
  frameless: false,
  transparent: false,
  alwaysOnTop: false,
  skipTaskbar: false,
};

const DEFAULT_ACCELERATOR = process.platform === 'darwin' ? 'Command+Shift+J' : 'Control+Shift+J';

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
  logger?.info('Primary hotkey triggered');
  ensureWindowFocus();
  const result = clipboard.getText();
  if (result.success) {
    mainWindow?.webContents.send('widget:showFromClipboard', {
      text: result.text,
      source: 'clipboard',
      timestamp: Date.now(),
    });
    logger?.info('Clipboard text dispatched to renderer', {
      length: result.text.length,
    });
  } else {
    logger?.warn('Clipboard read failed', result.error);
    mainWindow?.webContents.send('widget:clipboardError', {
      error: result.error,
      timestamp: Date.now(),
    });
  }
};

const registerPrimaryHotkey = () => {
  if (!hotkeyManager) {
    hotkeyManager = createHotkeyManager(logger);
  }
  const accelerator = DEFAULT_ACCELERATOR;
  const options = {};
  if (process.platform === 'win32') {
    options.enableDoubleCtrl = true;
  }
  const success = hotkeyManager.registerToggle({ accelerator, handler: handleHotkeyTrigger, options });
  if (success) {
    logger?.info('Primary hotkey registered', { accelerator });
  } else {
    logger?.warn('Primary hotkey registration failed', { accelerator });
  }
  return success;
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
};

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  logger = createLogBridge(() => mainWindow);
  createWindow();
  registerPrimaryHotkey();
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
});

app.on('window-all-closed', () => {
  logger?.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
