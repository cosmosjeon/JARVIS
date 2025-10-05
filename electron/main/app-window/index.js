const path = require('path');
const { BrowserWindow } = require('electron');
const { applyWindowConfigTo, windowConfig, sendWindowState } = require('../bootstrap/window-state');
const { getRendererUrl } = require('../bootstrap/renderer-url');
const { broadcastSettings } = require('../bootstrap/settings-broadcast');

let mainWindow;
const additionalWidgetWindows = new Set();
const widgetSessionByWindowId = new Map();

const createMainWindow = ({
  treeId = null,
  sessionId,
  fresh = false,
  isDev = false,
  logger,
}) => {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 320,
    minHeight: 240,
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

  applyWindowConfigTo(mainWindow);
  mainWindow.setBackgroundColor('#00000000');

  const broadcastWindowState = () => {
    sendWindowState(mainWindow);
  };

  mainWindow.on('maximize', broadcastWindowState);
  mainWindow.on('unmaximize', broadcastWindowState);
  mainWindow.on('enter-full-screen', broadcastWindowState);
  mainWindow.on('leave-full-screen', broadcastWindowState);

  mainWindow.on('ready-to-show', () => {
    mainWindow.setMenuBarVisibility(false);
    if (process.platform === 'darwin' && windowConfig.frameless) {
      mainWindow.setWindowButtonVisibility?.(false);
    }
    logger?.info('Main window ready (kept hidden until explicitly toggled)');
  });

  mainWindow.on('closed', () => {
    logger?.info('Main window closed');
    widgetSessionByWindowId.delete(mainWindow.id);
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      require('electron').shell.openExternal(url);
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
    broadcastSettings(mainWindow);
    broadcastWindowState();
    if (treeId) {
      mainWindow.webContents.send('widget:set-active-tree', { treeId });
    }
  });

  widgetSessionByWindowId.set(mainWindow.id, sessionId);
  return mainWindow;
};

const createAdditionalWidgetWindow = ({
  treeId = null,
  sessionId,
  fresh = true,
  isDev = false,
  settings,
}) => {
  const isMac = process.platform === 'darwin';

  const widgetWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 320,
    minHeight: 240,
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

  ['enter-full-screen', 'leave-full-screen', 'maximize', 'unmaximize', 'show', 'hide'].forEach((eventName) => {
    widgetWindow.on(eventName, () => sendWindowState(widgetWindow));
  });

  widgetWindow.on('closed', () => {
    additionalWidgetWindows.delete(widgetWindow);
    widgetSessionByWindowId.delete(widgetWindow.id);
  });

  widgetWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  widgetWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== widgetWindow.webContents.getURL()) {
      event.preventDefault();
      require('electron').shell.openExternal(url);
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
    sendWindowState(widgetWindow);
  });

  additionalWidgetWindows.add(widgetWindow);
  widgetSessionByWindowId.set(widgetWindow.id, sessionId);
  return widgetWindow;
};

const getMainWindow = () => mainWindow;
const getAdditionalWidgetWindows = () => Array.from(additionalWidgetWindows);

module.exports = {
  createMainWindow,
  createAdditionalWidgetWindow,
  getMainWindow,
  getAdditionalWidgetWindows,
  widgetSessionByWindowId,
};
