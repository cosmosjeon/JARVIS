const path = require('path');
const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const { createLogBridge } = require('./logger');
const { createHotkeyManager } = require('./hotkeys');
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
  frameless: false,       // 창 테두리 표시
  transparent: false,     // 투명 효과 비활성화
  alwaysOnTop: true,      // 항상 위에 표시
  skipTaskbar: true,      // 작업표시줄에 안 보이게
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
  logger?.info('Main window shown via hotkey');
};

const handleAltBacktickToggle = () => {
  if (!mainWindow) {
    logger?.warn('Alt+` triggered but main window is not available');
    return;
  }

  logger?.info('Alt+` triggered - toggling window visibility');

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    logger?.info('Main window hidden via Alt+`');
  } else {
    ensureWindowFocus();
    logger?.info('Main window shown via Alt+`');
  }
};

const registerPrimaryHotkey = () => {
  if (!hotkeyManager) {
    hotkeyManager = createHotkeyManager(logger);
  }
  hotkeyManager.unregisterAll?.();

  // Windows에서 더블 Ctrl 사용 시 Ctrl 키만 등록
  let accelerator, options = {};

  if (process.platform === 'win32' && settings.doubleCtrlEnabled) {
    accelerator = 'Alt+`';
    options.enableDoubleCtrl = false; // Alt+`를 한 번만 누르면 감지
  } else {
    accelerator = typeof settings.accelerator === 'string' && settings.accelerator.trim()
      ? settings.accelerator.trim()
      : DEFAULT_ACCELERATOR;
  }

  // Alt+` 키인 경우 Alt+` 토글 핸들러 사용
  const handler = (accelerator === 'Alt+`') ? handleAltBacktickToggle : handleHotkeyTrigger;
  const success = hotkeyManager.registerToggle({ accelerator, handler, options });
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
        onToggle: () => handleAltBacktickToggle(),
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
    // 창 크기 설정
    width: 1024,
    height: 720,
    minWidth: 520,
    minHeight: 360,

    // 창 프레임 설정
    frame: true,                // 창 테두리 및 상단바 표시
    transparent: false,         // 투명 효과 비활성화
    backgroundColor: '#ffffff', // 흰색 배경

    // 창 동작 설정
    alwaysOnTop: true,          // 항상 위에 표시
    skipTaskbar: true,          // 작업표시줄에 안 보이게
    hasShadow: true,            // 창 그림자 표시
    resizable: true,            // 크기 조절 가능
    movable: true,              // 이동 가능

    // 기타 설정
    show: false,                // 처음엔 숨김 (준비되면 표시)
    fullscreenable: true,
    maximizable: true,
    minimizable: true,
    titleBarStyle: 'default',   // 기본 타이틀바 표시
    autoHideMenuBar: true,
    title: 'JARVIS Widget',

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: false,
      // 화질 개선을 위한 설정
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // 고해상도 렌더링 설정
      offscreen: false,
      // GPU 가속 활성화
      hardwareAcceleration: true,
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

    const wasVisible = mainWindow.isVisible();
    handleAltBacktickToggle();

    return {
      success: true,
      visible: !wasVisible
    };
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
