const path = require('path');

// Load environment variables early so downstream modules can read them (e.g. LLM service)
try {
  // Attempt to load project root .env; errors are ignored so packaged builds can proceed
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('[electron] Failed to load .env file:', error?.message);
}

const { randomUUID } = require('crypto');
const { app, BrowserWindow, ipcMain, nativeTheme, shell, screen, globalShortcut } = require('electron');
const { createLogBridge } = require('./logger');
const { createHotkeyManager } = require('./hotkeys');
const accessibility = require('./accessibility');
const logs = require('./logs');
const settingsStore = require('./settings');
const { createTray } = require('./tray');
const { LLMService } = require('./services/llm-service');
const http = require('http');

const DEFAULT_AUTH_CALLBACK_PORT = 54545;

const isDev = !app.isPackaged;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const pendingOAuthCallbacks = [];

const sendOAuthCallbackToRenderers = (url) => {
  if (!url) {
    return;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      const host = parsed.host;
      if (
        !host.includes('gkdiarpitajgbfpvkazc.supabase.co') &&
        !host.startsWith('localhost') &&
        !host.startsWith('127.0.0.1')
      ) {
        return;
      }
    }
  } catch (error) {
    // ignore malformed URLs
  }

  const targets = [];
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    targets.push(libraryWindow);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    targets.push(mainWindow);
  }

  if (targets.length === 0) {
    pendingOAuthCallbacks.push(url);
    return;
  }

  targets.forEach((target) => target.webContents.send('auth:oauth-callback', url));

  const focusTarget = libraryWindow && !libraryWindow.isDestroyed()
    ? libraryWindow
    : (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);

  if (focusTarget) {
    focusTarget.show();
    focusTarget.focus();
  }
};

const handleOAuthDeepLink = (url) => {
  if (!url || typeof url !== 'string') {
    return;
  }
  sendOAuthCallbackToRenderers(url);
};

const ensureAuthCallbackServer = () => {
  if (authServerReadyPromise) {
    return authServerReadyPromise;
  }

  authServerReadyPromise = new Promise((resolve, reject) => {
    const desiredPort = parseInt(process.env.SUPABASE_CALLBACK_PORT || '', 10);

    authServer = http.createServer((req, res) => {
      try {
        if (!req.url) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid request');
          return;
        }

        const effectivePort = authServerPort || desiredPort || DEFAULT_AUTH_CALLBACK_PORT;
        const requestUrl = new URL(req.url, `http://127.0.0.1:${effectivePort}`);

        if (requestUrl.pathname !== '/auth/callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }

        logger?.info('Auth callback received', { url: requestUrl.toString() });
        sendOAuthCallbackToRenderers(requestUrl.toString());

        const html = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>로그인이 완료되었습니다</title>
    <meta name="robots" content="noindex" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; }
      main { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
      .card { background: rgba(15,23,42,0.72); padding: 32px 28px; border-radius: 16px; max-width: 360px; text-align: center; box-shadow: 0 24px 60px rgba(15,23,42,0.35); border: 1px solid rgba(148,163,184,0.18); }
      h1 { font-size: 20px; font-weight: 600; margin: 0 0 12px; }
      p { font-size: 14px; line-height: 1.6; color: rgba(226,232,240,0.78); margin: 0 0 20px; }
      button { width: 100%; padding: 12px 16px; border-radius: 12px; border: none; font-weight: 600; font-size: 15px; cursor: pointer; background: linear-gradient(135deg, #38bdf8, #6366f1); color: #0f172a; }
      small { display: block; margin-top: 12px; font-size: 12px; color: rgba(148,163,184,0.75); }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <h1>로그인이 완료되었습니다</h1>
        <p>JARVIS 앱으로 돌아가는 중입니다. 브라우저 창은 닫아도 됩니다.</p>
        <button onclick="finish()">앱으로 돌아가기</button>
        <small>창이 닫히지 않으면 버튼을 다시 눌러주세요.</small>
      </div>
    </main>
    <script>
      function finish() {
        window.close();
        setTimeout(function () { window.close(); }, 1500);
      }
      setTimeout(finish, 500);
    </script>
  </body>
</html>`;

        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
        });
        res.end(html);
      } catch (error) {
        logger?.error('auth_callback_handler_error', { message: error?.message });
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal error');
      }
    });

    authServer.on('error', (error) => {
      logger?.error('auth_callback_server_error', { message: error?.message });
      reject(error);
    });

    const listenPort = Number.isInteger(desiredPort) && desiredPort > 0 ? desiredPort : DEFAULT_AUTH_CALLBACK_PORT;

    authServer.listen(listenPort, '127.0.0.1', () => {
      authServerPort = authServer.address().port;
      logger?.info('Auth callback server listening', { authServerPort });
      resolve(authServerPort);
    });
  });

  return authServerReadyPromise;
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', (_event, argv) => {
  const deepLinkArg = argv.find((arg) => typeof arg === 'string' && arg.startsWith('jarvis://'));
  if (deepLinkArg) {
    handleOAuthDeepLink(deepLinkArg);
  }

  if (libraryWindow && !libraryWindow.isDestroyed()) {
    if (libraryWindow.isMinimized()) {
      libraryWindow.restore();
    }
    libraryWindow.show();
    libraryWindow.focus();
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    ensureWindowFocus();
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleOAuthDeepLink(url);
});

let mainWindow;
let libraryWindow;
let logger;
let hotkeyManager;
let tray;
let broadcastWindowState = () => {};
let llmService;
let authServer = null;
let authServerPort = null;
let authServerReadyPromise = null;

const additionalWidgetWindows = new Set();
const widgetSessionByWindowId = new Map();

const WINDOW_CHROME_HEIGHT = 48; // 커스텀 타이틀바 높이와 맞춤

const windowConfig = {
  frameless: true,        // 기본적으로 프레임 없는 창 사용
  transparent: true,      // 완전 투명 창 사용
  alwaysOnTop: true,      // 항상 위에 표시
  skipTaskbar: true,      // 작업표시줄에 안 보이게
};

const applyWindowConfigTo = (targetWindow) => {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  targetWindow.setAlwaysOnTop(windowConfig.alwaysOnTop, 'floating', 1);
  targetWindow.setSkipTaskbar(windowConfig.skipTaskbar);
  targetWindow.setMenuBarVisibility(!windowConfig.frameless);
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
  const payload = { ...settings };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:changed', payload);
  }

  additionalWidgetWindows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('settings:changed', payload);
    }
  });
};

const generateSessionId = () => {
  try {
    return randomUUID();
  } catch (error) {
    return `session_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }
};

const getRendererUrl = (mode = 'widget', params = {}) => {
  const baseUrl = isDev
    ? process.env.ELECTRON_START_URL || 'http://localhost:3000'
    : `file://${path.join(__dirname, '..', 'build', 'index.html')}`;

  const url = new URL(baseUrl);
  url.searchParams.set('mode', mode);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    url.searchParams.set(key, value);
  });

  return url.toString();
};

const createWindow = ({ treeId = null, sessionId = generateSessionId(), fresh = false } = {}) => {
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
    alwaysOnTop: windowConfig.alwaysOnTop,          // 항상 위에 표시
    skipTaskbar: windowConfig.skipTaskbar,          // 작업표시줄에 안 보이게
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

  applyWindowConfigTo(mainWindow);

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
    if (process.platform === 'darwin' && windowConfig.frameless) {
      mainWindow.setWindowButtonVisibility?.(false);
    }

    logger?.info('Main window ready (kept hidden until explicitly toggled)');
  });

  mainWindow.on('closed', () => {
    logger?.info('Main window closed');
    if (mainWindow) {
      widgetSessionByWindowId.delete(mainWindow.id);
    }
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const startUrl = getRendererUrl('widget', {
    session: sessionId,
    fresh: fresh ? '1' : undefined,
    treeId: treeId || undefined,
  });

  logger?.info('Loading URL', { startUrl });
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastSettings();
    broadcastWindowState();
    if (treeId) {
      mainWindow.webContents.send('widget:set-active-tree', { treeId });
    }
  });

  widgetSessionByWindowId.set(mainWindow.id, sessionId);
};

const createAdditionalWidgetWindow = ({ treeId = null, sessionId = generateSessionId(), fresh = true } = {}) => {
  const isMac = process.platform === 'darwin';

  const widgetWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 520,
    minHeight: 360,
    frame: false,
    transparent: windowConfig.transparent,
    backgroundColor: '#00000000',
    alwaysOnTop: windowConfig.alwaysOnTop,
    skipTaskbar: windowConfig.skipTaskbar,
    hasShadow: true,
    resizable: true,
    movable: true,
    show: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    titleBarStyle: isMac ? 'customButtonsOnHover' : 'default',
    ...(isMac ? {
      trafficLightPosition: { x: -1000, y: -1000 },
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

  applyWindowConfigTo(widgetWindow);
  widgetWindow.setBackgroundColor('#00000000');
  widgetWindow.setMenuBarVisibility(false);
  if (isMac && windowConfig.frameless) {
    widgetWindow.setWindowButtonVisibility?.(false);
  }

  widgetWindow.on('ready-to-show', () => {
    widgetWindow.show();
    widgetWindow.focus();
  });

  widgetWindow.on('closed', () => {
    additionalWidgetWindows.delete(widgetWindow);
    widgetSessionByWindowId.delete(widgetWindow.id);
  });

  widgetWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  widgetWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== widgetWindow.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const startUrl = getRendererUrl('widget', {
    session: sessionId,
    fresh: fresh ? '1' : undefined,
    treeId: treeId || undefined,
  });
  widgetWindow.loadURL(startUrl);

  widgetWindow.webContents.on('did-finish-load', () => {
    widgetWindow.webContents.send('settings:changed', { ...settings });
    if (treeId) {
      widgetWindow.webContents.send('widget:set-active-tree', { treeId });
    }
  });

  additionalWidgetWindows.add(widgetWindow);
  widgetSessionByWindowId.set(widgetWindow.id, sessionId);
  return widgetWindow;
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
      const resource = process.argv[1] ? path.resolve(process.argv[1]) : path.join(__dirname, 'main.js');
      app.setAsDefaultProtocolClient('jarvis', executable, ['--', resource]);
    } else {
      app.setAsDefaultProtocolClient('jarvis');
    }
  };

  registerDeepLinkScheme();

  nativeTheme.themeSource = 'dark';
  loadSettings();
  logger = createLogBridge(() => mainWindow);
  llmService = new LLMService({ logger });
  createWindow({ fresh: false });
  createLibraryWindow();
  ensureAuthCallbackServer().catch((error) => {
    logger?.error('auth_callback_server_start_failed', { message: error?.message });
  });

  const initialDeepLinkArg = process.argv.find((arg) => typeof arg === 'string' && arg.startsWith('jarvis://'));
  if (initialDeepLinkArg) {
    pendingOAuthCallbacks.push(initialDeepLinkArg);
  }

  if (pendingOAuthCallbacks.length > 0) {
    const pending = [...pendingOAuthCallbacks];
    pendingOAuthCallbacks.length = 0;
    pending.forEach((url) => sendOAuthCallbackToRenderers(url));
  }
  applyHotkeySettings();
  applyTraySettings();
  registerPassThroughShortcut();
  broadcastSettings();
  ipcMain.handle('auth:launch-oauth', async (_event, payload = {}) => {
    const targetUrl = typeof payload?.url === 'string' ? payload.url : null;
    if (!targetUrl) {
      return { success: false, error: { code: 'invalid_url', message: 'OAuth URL required' } };
    }

    try {
      await shell.openExternal(targetUrl);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'open_external_failed',
          message: error?.message || 'Failed to open OAuth URL in browser',
        },
      };
    }
  });
  ipcMain.handle('auth:get-callback-url', async (_event, payload = {}) => {
    try {
      const port = await ensureAuthCallbackServer();
      const params = new URLSearchParams();
      if (payload?.mode) {
        params.set('mode', payload.mode);
      }
      const query = params.toString();
      return {
        success: true,
        url: `http://127.0.0.1:${port}/auth/callback${query ? `?${query}` : ''}`,
      };
    } catch (error) {
      logger?.error('auth_callback_url_failed', { message: error?.message });
      return {
        success: false,
        error: {
          code: 'callback_not_ready',
          message: error?.message || 'Failed to prepare auth callback server',
        },
      };
    }
  });
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

  ipcMain.handle('window:openWidget', (_event, payload = {}) => {
    const requestedTreeId = typeof payload?.treeId === 'string' && payload.treeId.trim()
      ? payload.treeId.trim()
      : null;
    const reusePrimary = Boolean(payload?.reusePrimary);
    const forceFresh = Boolean(payload?.fresh ?? !reusePrimary);

    if (reusePrimary) {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow({ treeId: requestedTreeId || null, fresh: forceFresh });
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        if (!mainWindow.isVisible()) {
          ensureWindowFocus();
        } else {
          mainWindow.focus();
        }

        if (requestedTreeId) {
          mainWindow.webContents.send('widget:set-active-tree', { treeId: requestedTreeId });
        }

        return {
          success: true,
          windowId: mainWindow.id,
          reusedPrimary: true,
          sessionId: widgetSessionByWindowId.get(mainWindow.id) || null,
        };
      }
    }

    const newWindow = createAdditionalWidgetWindow({
      treeId: requestedTreeId || null,
      fresh: forceFresh,
    });

    return {
      success: true,
      windowId: newWindow.id,
      reusedPrimary: false,
      sessionId: widgetSessionByWindowId.get(newWindow.id) || null,
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

    const targets = [];
    if (mainWindow && !mainWindow.isDestroyed()) {
      targets.push(mainWindow);
    }

    additionalWidgetWindows.forEach((win) => {
      if (!win.isDestroyed()) {
        targets.push(win);
      }
    });

    targets.forEach((win) => applyWindowConfigTo(win));

    logger?.info('Window config updated', windowConfig);
    return windowConfig;
  });

  app.on('activate', () => {
    if (!mainWindow) {
      createWindow({ fresh: false });
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
  if (authServer) {
    try {
      authServer.close();
      logger?.info('Auth callback server closed');
    } catch (error) {
      logger?.warn('auth_callback_server_close_failed', { message: error?.message });
    }
  }
});

app.on('window-all-closed', () => {
  logger?.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
