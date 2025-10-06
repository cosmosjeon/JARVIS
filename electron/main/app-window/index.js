const path = require('path');
const { BrowserWindow, shell } = require('electron');
const {
  windowConfig,
  applyWindowConfigTo,
  sendWindowState,
} = require('../bootstrap/window-state');
const { getRendererUrl } = require('../bootstrap/renderer-url');
const { broadcastSettings } = require('../bootstrap/settings-broadcast');

const createWidgetWindow = ({
  sessionId,
  treeId = null,
  fresh = false,
  isDev = false,
  settings = {},
  logger,
  onReady,
  onClosed,
}) => {
  const isMac = process.platform === 'darwin';

  const window = new BrowserWindow({
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

  applyWindowConfigTo(window);
  window.setBackgroundColor('#00000000');

  const broadcastWindowState = () => sendWindowState(window);

  window.on('maximize', broadcastWindowState);
  window.on('unmaximize', broadcastWindowState);
  window.on('enter-full-screen', broadcastWindowState);
  window.on('leave-full-screen', broadcastWindowState);

  window.on('ready-to-show', () => {
    window.setMenuBarVisibility(false);
    if (process.platform === 'darwin' && windowConfig.frameless) {
      window.setWindowButtonVisibility?.(false);
    }
    logger?.info('Widget window ready');
    onReady?.(window);
  });

  window.on('closed', () => {
    logger?.info('Widget window closed');
    onClosed?.(window);
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const startUrl = getRendererUrl('widget', {
    session: sessionId,
    fresh: fresh ? '1' : undefined,
    treeId: treeId || undefined,
  });

  logger?.info('Loading widget URL', { startUrl });
  window.loadURL(startUrl);

  window.webContents.on('did-finish-load', () => {
    broadcastSettings(window, settings);
    broadcastWindowState();
    if (treeId) {
      window.webContents.send('widget:set-active-tree', { treeId });
    }
  });

  return window;
};

const ensureMainWindowFocus = (window) => {
  if (!window) {
    return;
  }
  if (!window.isVisible()) {
    window.show();
  }
  if (window.isMinimized()) {
    window.restore();
  }
  window.focus();
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
  createWidgetWindow,
  ensureMainWindowFocus,
  resolveBrowserWindowFromSender,
};
