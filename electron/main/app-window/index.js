const path = require('path');
const { randomUUID } = require('crypto');
const { BrowserWindow, shell } = require('electron');
const {
  windowConfig,
  applyWindowConfigTo,
  sendWindowState,
} = require('../bootstrap/window-state');
const { getRendererUrl } = require('../bootstrap/renderer-url');
const { broadcastSettings } = require('../bootstrap/settings-broadcast');

let mainWindow = null;
let widgetsCurrentlyVisible = false;
const additionalWidgetWindows = new Set();
const widgetSessionByWindowId = new Map();

const generateSessionId = () => {
  try {
    return randomUUID();
  } catch (error) {
    return `session_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }
};

const getLivingWindowSet = (collection) => {
  const entries = Array.from(collection);
  entries.forEach((win) => {
    if (!win || win.isDestroyed()) {
      collection.delete(win);
    }
  });
  return collection;
};

const getMainWindow = () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);

const trackWidgetSession = (window, sessionId) => {
  if (!window || window.isDestroyed()) {
    return;
  }
  widgetSessionByWindowId.set(window.id, sessionId);
};

const removeWidgetSession = (window) => {
  if (!window) {
    return;
  }
  widgetSessionByWindowId.delete(window.id);
};

const getWidgetSession = (windowId) => widgetSessionByWindowId.get(windowId) || null;

const getAllWidgetWindows = () => {
  const windows = [];
  const main = getMainWindow();
  if (main) {
    windows.push(main);
  }

  getLivingWindowSet(additionalWidgetWindows).forEach((win) => {
    if (win && !win.isDestroyed()) {
      windows.push(win);
    }
  });

  return windows;
};

const attachWindowStateBroadcast = (window, logger) => {
  const broadcastWindowState = () => sendWindowState(window);
  ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'show', 'hide']
    .forEach((eventName) => {
      window.on(eventName, broadcastWindowState);
    });
  window.on('closed', () => {
    logger?.info?.('widget_window_state_teardown', { id: window.id });
  });
  return broadcastWindowState;
};

const initializeWidgetWindow = ({
  window,
  sessionId,
  treeId,
  logger,
  settings,
  autoShow,
  onReady,
  onClosed,
}) => {
  applyWindowConfigTo(window);
  window.setBackgroundColor('#00000000');

  window.on('ready-to-show', () => {
    window.setMenuBarVisibility(false);
    if (process.platform === 'darwin' && windowConfig.frameless) {
      window.setWindowButtonVisibility?.(false);
    }
    if (autoShow) {
      window.show();
      if (autoShow === 'focus') {
        window.focus();
      }
    }
    logger?.info?.('Widget window ready', { id: window.id, autoShow: Boolean(autoShow) });
    onReady?.(window);
  });

  window.on('closed', () => {
    logger?.info?.('Widget window closed', { id: window.id });
    if (window === mainWindow) {
      mainWindow = null;
    } else {
      additionalWidgetWindows.delete(window);
    }
    removeWidgetSession(window);
    onClosed?.(window);
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const broadcastWindowState = attachWindowStateBroadcast(window, logger);

  window.webContents.on('did-finish-load', () => {
    broadcastSettings(window, settings);
    broadcastWindowState();
    if (treeId) {
      window.webContents.send('widget:set-active-tree', { treeId });
    }
  });

  trackWidgetSession(window, sessionId);
  return window;
};

const createMainWindow = ({
  logger,
  settings = {},
  sessionId = generateSessionId(),
  treeId = null,
  fresh = false,
  isDev = false,
  onReady,
  onClosed,
} = {}) => {
  const livingMain = getMainWindow();
  if (livingMain) {
    return { window: livingMain, sessionId: getWidgetSession(livingMain.id) };
  }

  const isMac = process.platform === 'darwin';

  // fresh=true (새 트리)인 경우 작은 크기로 시작
  const isNewTree = fresh === true;
  const initialWidth = isNewTree ? 430 : 1024;
  const initialHeight = isNewTree ? 130 : 720;

  const window = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth: isNewTree ? 320 : 320,
    minHeight: isNewTree ? 130 : 240,
    frame: false,
    transparent: windowConfig.transparent,
    backgroundColor: '#00000000',
    alwaysOnTop: windowConfig.alwaysOnTop,
    skipTaskbar: windowConfig.skipTaskbar,
    hasShadow: true,
    resizable: true,
    movable: true,
    show: false,
    fullscreenable: true,
    maximizable: true,
    minimizable: false,
    titleBarStyle: isMac ? 'customButtonsOnHover' : 'default',
    ...(isMac ? { trafficLightPosition: { x: -1000, y: -1000 } } : {}),
    autoHideMenuBar: true,
    title: 'JARVIS Widget',
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: false,
    },
  });

  const widgetWindow = initializeWidgetWindow({
    window,
    sessionId,
    treeId,
    logger,
    settings,
    autoShow: false,
    onReady,
    onClosed,
  });

  const startUrl = getRendererUrl('widget', {
    session: sessionId,
    fresh: fresh ? '1' : undefined,
    treeId: treeId || undefined,
  });

  logger?.info?.('Loading primary widget URL', { startUrl });
  widgetWindow.loadURL(startUrl);

  mainWindow = widgetWindow;
  return { window: widgetWindow, sessionId };
};

const createWidgetWindow = ({
  logger,
  settings = {},
  sessionId = generateSessionId(),
  treeId = null,
  fresh = true,
  isDev = false,
  onReady,
  onClosed,
} = {}) => {
  const isMac = process.platform === 'darwin';

  // fresh=true (새 트리)인 경우 작은 크기로 시작
  const isNewTree = fresh === true;
  const initialWidth = isNewTree ? 430 : 1024;
  const initialHeight = isNewTree ? 130 : 720;

  const window = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth: isNewTree ? 320 : 320,
    minHeight: isNewTree ? 130 : 240,
    frame: false,
    transparent: windowConfig.transparent,
    backgroundColor: '#00000000',
    alwaysOnTop: windowConfig.alwaysOnTop,
    skipTaskbar: windowConfig.skipTaskbar,
    hasShadow: true,
    resizable: true,
    movable: true,
    show: false,
    fullscreenable: true,
    maximizable: true,
    minimizable: false,
    titleBarStyle: isMac ? 'customButtonsOnHover' : 'default',
    ...(isMac ? { trafficLightPosition: { x: -1000, y: -1000 } } : {}),
    autoHideMenuBar: true,
    title: 'JARVIS Widget',
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: false,
    },
  });

  const widgetWindow = initializeWidgetWindow({
    window,
    sessionId,
    treeId,
    logger,
    settings,
    autoShow: 'focus',
    onReady,
    onClosed,
  });

  const startUrl = getRendererUrl('widget', {
    session: sessionId,
    fresh: fresh ? '1' : undefined,
    treeId: treeId || undefined,
  });

  logger?.info?.('Loading additional widget URL', { startUrl });
  widgetWindow.loadURL(startUrl);

  additionalWidgetWindows.add(widgetWindow);
  widgetsCurrentlyVisible = true;

  return { window: widgetWindow, sessionId };
};

const ensureMainWindowFocus = () => {
  const target = getMainWindow();
  if (!target) {
    return;
  }
  if (!target.isVisible()) {
    target.show();
  }
  if (target.isMinimized()) {
    target.restore();
  }
  target.focus();
};

const hideAllWidgets = (logger) => {
  const windows = getAllWidgetWindows();
  windows.forEach((win) => {
    win.hide();
    logger?.info?.('Widget window hidden', { id: win.id });
  });
  widgetsCurrentlyVisible = false;
  return windows;
};

const showAllWidgets = (logger) => {
  const windows = getAllWidgetWindows();
  windows.forEach((win) => {
    win.show();
    if (win.isMinimized()) {
      win.restore();
    }
    win.focus();
    logger?.info?.('Widget window shown', { id: win.id });
  });
  widgetsCurrentlyVisible = windows.length > 0;
  return windows;
};

const toggleWidgetVisibility = (logger) => {
  const windows = getAllWidgetWindows();
  if (windows.length === 0) {
    logger?.warn?.('No widget windows available to toggle');
    return { visible: false, windows };
  }

  if (widgetsCurrentlyVisible) {
    hideAllWidgets(logger);
  } else {
    showAllWidgets(logger);
  }

  return { visible: widgetsCurrentlyVisible, windows };
};

const areWidgetsVisible = () => widgetsCurrentlyVisible;

const broadcastSettingsToWidgets = (settings = {}) => {
  getAllWidgetWindows().forEach((win) => {
    broadcastSettings(win, settings);
  });
};

const resolveBrowserWindowFromSender = (sender) => {
  if (!sender) {
    return null;
  }

  const directWindow = BrowserWindow.fromWebContents(sender);
  if (directWindow) {
    return directWindow;
  }

  if (typeof sender.getOwnerBrowserWindow === 'function') {
    const ownerWindow = sender.getOwnerBrowserWindow();
    if (ownerWindow) {
      return ownerWindow;
    }
  }

  if (sender.hostWebContents) {
    const hostWindow = resolveBrowserWindowFromSender(sender.hostWebContents);
    if (hostWindow) {
      return hostWindow;
    }
  }

  const senderId = typeof sender.id === 'number' ? sender.id : null;
  if (senderId !== null) {
    const fallbackWindow = BrowserWindow.getAllWindows().find((win) => win.webContents.id === senderId);
    if (fallbackWindow) {
      return fallbackWindow;
    }
  }

  return null;
};

module.exports = {
  createMainWindow,
  createWidgetWindow,
  ensureMainWindowFocus,
  toggleWidgetVisibility,
  areWidgetsVisible,
  getMainWindow,
  getAllWidgetWindows,
  broadcastSettingsToWidgets,
  getWidgetSession,
  generateSessionId,
  resolveBrowserWindowFromSender,
};
