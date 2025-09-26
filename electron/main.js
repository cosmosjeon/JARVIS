const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Fallback for setups that keep the OpenAI key in API_KEY.env
if (!process.env.OPENAI_API_KEY) {
  const apiKeyEnvPath = path.resolve(__dirname, '..', 'API_KEY.env');
  if (fs.existsSync(apiKeyEnvPath)) {
    require('dotenv').config({ path: apiKeyEnvPath });
  }
}

const { app, BrowserWindow, ipcMain, nativeTheme, shell, screen, globalShortcut } = require('electron');
const { createLogBridge } = require('./logger');
const { createHotkeyManager } = require('./hotkeys');
const accessibility = require('./accessibility');
const logs = require('./logs');
const settingsStore = require('./settings');
const { createTray } = require('./tray');
const { LLMService } = require('./services/llm-service');

const isDev = !app.isPackaged;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let mainWindow;
let libraryWindow;
let logger;
let hotkeyManager;
let tray;
let broadcastWindowState = () => {};
let llmService;

const WINDOW_CHROME_HEIGHT = 48; // 커스텀 타이틀바 높이와 맞춤

const windowConfig = {
  frameless: true,        // 기본적으로 프레임 없는 창 사용
  transparent: true,      // 완전 투명 창 사용
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

const registerPassThroughShortcut = () => {
  const accelerator = 'CommandOrControl+2';
  const success = globalShortcut.register(accelerator, () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    ensureWindowFocus();
    mainWindow.webContents.send('pass-through:toggle');
  });

  if (success) {
    logger?.info('Pass-through shortcut registered', { accelerator });
  } else {
    logger?.warn('Failed to register pass-through shortcut', { accelerator });
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

const getRendererUrl = (mode = 'widget') => {
  const baseUrl = isDev
    ? process.env.ELECTRON_START_URL || 'http://localhost:3000'
    : `file://${path.join(__dirname, '..', 'build', 'index.html')}`;
  if (mode === 'widget') {
    return baseUrl.includes('?') ? `${baseUrl}&mode=widget` : `${baseUrl}?mode=widget`;
  }
  return baseUrl.includes('?') ? `${baseUrl}&mode=${mode}` : `${baseUrl}?mode=${mode}`;
};

const createWindow = () => {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    // 창 크기 설정
    width: 1024,
    height: 720,
    minWidth: 520,
    minHeight: 360,

    // 창 프레임 설정
    frame: false,                             // 완전히 프레임 제거
    transparent: windowConfig.transparent,    // 완전 투명 창 사용
    backgroundColor: '#00000000',             // 완전 투명 배경

    // 창 동작 설정
    alwaysOnTop: true,          // 항상 위에 표시
    skipTaskbar: true,          // 작업표시줄에 안 보이게
    hasShadow: true,            // 창 그림자 표시
    resizable: true,            // 크기 조절 가능
    movable: true,              // 이동 가능

    // 기타 설정
    show: false,                // 처음엔 숨김 (준비되면 표시)
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    titleBarStyle: process.platform === 'darwin' ? 'customButtonsOnHover' : 'default',
    ...(process.platform === 'darwin' ? {
      trafficLightPosition: { x: -1000, y: -1000 }  // 트래픽 라이트를 완전히 화면 밖으로
    } : {}),
    autoHideMenuBar: true,
    title: 'JARVIS Widget',

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: false,
    },
  });

  mainWindow.setBackgroundColor('#00000000');

  broadcastWindowState = () => {
    if (!mainWindow) return;
    mainWindow.webContents.send('window:state', {
      maximized: mainWindow.isMaximized(),
      fullscreen: mainWindow.isFullScreen(),
    });
  };

  mainWindow.on('maximize', broadcastWindowState);
  mainWindow.on('unmaximize', broadcastWindowState);
  mainWindow.on('enter-full-screen', broadcastWindowState);
  mainWindow.on('leave-full-screen', broadcastWindowState);

  mainWindow.on('ready-to-show', () => {
    // 완전한 위젯 모드를 위해 메뉴바 완전히 제거
    mainWindow.setMenuBarVisibility(false);

    // macOS에서 트래픽 라이트 버튼 완전히 숨기기
    if (process.platform === 'darwin') {
      mainWindow.setWindowButtonVisibility?.(false);
    }

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

  const startUrl = getRendererUrl('widget');

  logger?.info('Loading URL', { startUrl });
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastSettings();
    broadcastWindowState();
  });
};

const createLibraryWindow = () => {
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    libraryWindow.focus();
    return;
  }

  libraryWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'JARVIS Library',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: false,
    },
  });

  const libraryUrl = getRendererUrl('library');
  logger?.info('Loading library URL', { libraryUrl });
  libraryWindow.loadURL(libraryUrl);

  libraryWindow.on('ready-to-show', () => {
    libraryWindow?.show();
  });

  libraryWindow.on('closed', () => {
    libraryWindow = null;
  });

  libraryWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  libraryWindow.webContents.on('will-navigate', (event, url) => {
    if (!libraryWindow) return;
    if (url !== libraryWindow.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
};

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  loadSettings();
  logger = createLogBridge(() => mainWindow);
  llmService = new LLMService({ logger });
  createWindow();
  createLibraryWindow();
  applyHotkeySettings();
  applyTraySettings();
  registerPassThroughShortcut();
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

  const handleLLMRequest = async (_event, payload = {}) => {
    try {
      const {
        messages = [],
        model,
        temperature,
        maxTokens,
      } = payload;

      const sanitizedMessages = Array.isArray(messages) ? messages : [];

      const result = await llmService.ask({
        messages: sanitizedMessages,
        model,
        temperature,
        maxTokens,
      });

      return { success: true, ...result };
    } catch (error) {
      const code = error?.code || 'openai_request_failed';
      const message = error?.message || 'OpenAI request failed';
      if (logger && typeof logger.error === 'function') {
        logger.error('agent_request_failed', { code, message });
      }
      return {
        success: false,
        error: {
          code,
          message,
        },
      };
    }
  };

  ipcMain.handle('agent:askRoot', handleLLMRequest);
  ipcMain.handle('agent:askChild', handleLLMRequest);

  const normalizeKeyword = (value) => {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return '';
    }
    const keyword = tokens[0];
    return keyword.slice(0, 48);
  };

  ipcMain.handle('agent:extractKeyword', async (_event, payload = {}) => {
    const question = typeof payload.question === 'string' ? payload.question.trim() : '';
    if (!question) {
      return {
        success: false,
        error: {
          code: 'invalid_question',
          message: 'Question text is required to extract a keyword.',
        },
      };
    }

    try {
      const messages = [
        {
          role: 'system',
          content: 'Extract the single most important keyword from the user question. Respond with exactly one word, without any additional text.',
        },
        {
          role: 'user',
          content: question,
        },
      ];

      const result = await llmService.ask({
        messages,
        model: payload.model,
        temperature: typeof payload.temperature === 'number' ? payload.temperature : 0,
        maxTokens: payload.maxTokens ?? 8,
      });

      const keyword = normalizeKeyword(result?.answer);
      if (!keyword) {
        return {
          success: false,
          error: {
            code: 'empty_keyword',
            message: 'AI did not return a usable keyword.',
          },
        };
      }

      return {
        success: true,
        keyword,
        usage: result?.usage || null,
      };
    } catch (error) {
      const code = error?.code || 'keyword_extraction_failed';
      const message = error?.message || 'Failed to extract keyword from question.';
      if (logger && typeof logger.warn === 'function') {
        logger.warn('agent_keyword_extraction_failed', { code, message });
      }
      return {
        success: false,
        error: {
          code,
          message,
        },
      };
    }
  });

  ipcMain.handle('settings:get', () => ({ success: true, settings: { ...settings } }));

  ipcMain.handle('window:setMousePassthrough', (_event, payload = {}) => {
    if (!mainWindow) {
      return { success: false, error: { code: 'no_window', message: 'Main window not available' } };
    }

    const ignore = typeof payload.ignore === 'boolean' ? payload.ignore : true;
    const forward = payload.forward !== false;

    try {
      const options = ignore && forward ? { forward: true } : undefined;
      mainWindow.setIgnoreMouseEvents(ignore, options);
      if (logger && typeof logger.debug === 'function') {
        logger.debug('window_mouse_passthrough_updated', { ignore, forward });
      }
      return { success: true, ignore };
    } catch (error) {
      if (logger && typeof logger.error === 'function') {
        logger.error('window_mouse_passthrough_failed', { message: error?.message });
      }
      return {
        success: false,
        error: {
          code: 'set_ignore_failed',
          message: error?.message || 'Failed to update mouse passthrough state',
        },
      };
    }
  });

  ipcMain.handle('cursor:getRelativePosition', () => {
    if (!mainWindow) {
      return { success: false, inside: false };
    }

    try {
      const cursorPoint = screen.getCursorScreenPoint();
      const bounds = mainWindow.getBounds();
      const inside = cursorPoint.x >= bounds.x
        && cursorPoint.x <= bounds.x + bounds.width
        && cursorPoint.y >= bounds.y
        && cursorPoint.y <= bounds.y + bounds.height;

      if (!inside) {
        return { success: true, inside: false };
      }

      const relativeX = cursorPoint.x - bounds.x;
      const relativeY = cursorPoint.y - bounds.y;

      return {
        success: true,
        inside: true,
        x: relativeX,
        y: relativeY,
      };
    } catch (error) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn('cursor_position_failed', { message: error?.message });
      }
      return { success: false, inside: false };
    }
  });

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

  ipcMain.handle('window:control', (_event, action) => {
    if (!mainWindow) {
      return { success: false, error: { code: 'no_window', message: 'Main window not available' } };
    }

    switch (action) {
      case 'minimize':
        mainWindow.minimize();
        broadcastWindowState();
        break;
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        broadcastWindowState();
        break;
      case 'close':
        mainWindow.close();
        break;
      default:
        return { success: false, error: { code: 'invalid_action', message: 'Unsupported window control action' } };
    }

    return {
      success: true,
      action,
      maximized: mainWindow.isMaximized(),
    };
  });

  ipcMain.handle('window:getState', () => {
    if (!mainWindow) {
      return { success: false, error: { code: 'no_window', message: 'Main window not available' } };
    }

    return {
      success: true,
      state: {
        maximized: mainWindow.isMaximized(),
        fullscreen: mainWindow.isFullScreen(),
        visible: mainWindow.isVisible(),
      },
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

    mainWindow.setMenuBarVisibility(!windowConfig.frameless);

    logger?.info('Window config updated', windowConfig);
    return windowConfig;
  });

  app.on('activate', () => {
    if (!mainWindow) {
      createWindow();
    }
    if (!libraryWindow) {
      createLibraryWindow();
    }
  });
});

app.on('browser-window-created', (_, window) => {
  window.setMenuBarVisibility(false);
  logger?.info('Browser window created');
});

app.on('will-quit', () => {
  globalShortcut.unregister('CommandOrControl+2');
  hotkeyManager?.dispose?.();
  tray?.dispose?.();
});

app.on('window-all-closed', () => {
  logger?.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
