const path = require('path');
const { BrowserWindow } = require('electron');
const { getRendererUrl } = require('./bootstrap/renderer-url');

let adminPanelWindow = null;

const positionAdminPanelWindow = (windowInstance, screen, logger) => {
  if (!windowInstance) {
    return;
  }

  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay?.workArea || primaryDisplay?.bounds;

    if (!workArea) {
      return;
    }

    const PADDING = 24;
    const { width: panelWidth, height: panelHeight } = windowInstance.getBounds();
    const targetX = Math.round(workArea.x + workArea.width - panelWidth - PADDING);
    const targetY = Math.round(workArea.y + PADDING);

    windowInstance.setBounds({
      x: targetX,
      y: targetY,
      width: panelWidth,
      height: panelHeight,
    });
  } catch (error) {
    logger?.warn('admin_panel_position_failed', { message: error?.message });
  }
};

const ensureAdminPanelWindow = ({ screen, isDev = false, logger }) => {
  if (adminPanelWindow && !adminPanelWindow.isDestroyed()) {
    adminPanelWindow.setOpacity(1);
    adminPanelWindow.show();
    adminPanelWindow.focus();
    try {
      adminPanelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch (error) {
      logger?.warn('admin_panel_workspace_visibility_failed', { message: error?.message });
    }
    return adminPanelWindow;
  }

  adminPanelWindow = new BrowserWindow({
    width: 420,
    height: 88,
    useContentSize: true,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    hasShadow: false,
    roundedCorners: true,
    titleBarStyle: process.platform === 'darwin' ? 'customButtonsOnHover' : 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: false,
    },
  });

  try {
    adminPanelWindow.setAlwaysOnTop(true, 'floating', 1);
    adminPanelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    adminPanelWindow.setOpacity(1);
  } catch (error) {
    logger?.warn('admin_panel_always_on_top_failed', { message: error?.message });
  }

  const panelUrl = getRendererUrl('admin-panel');
  logger?.info?.('Loading admin panel URL', { panelUrl });
  adminPanelWindow.loadURL(panelUrl);

  adminPanelWindow.on('ready-to-show', () => {
    positionAdminPanelWindow(adminPanelWindow, screen, logger);
    adminPanelWindow.setOpacity(1);
    adminPanelWindow.show();
    adminPanelWindow.focus();
  });

  adminPanelWindow.on('closed', () => {
    adminPanelWindow = null;
  });

  adminPanelWindow.on('show', () => {
    try {
      adminPanelWindow.setOpacity(1);
      adminPanelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch (error) {
      logger?.warn('admin_panel_show_visibility_failed', { message: error?.message });
    }
  });

  adminPanelWindow.webContents.on('did-finish-load', () => {
    adminPanelWindow.setOpacity(1);
  });

  adminPanelWindow.setOpacity(1);

  return adminPanelWindow;
};

const closeAdminPanelWindow = () => {
  if (adminPanelWindow && !adminPanelWindow.isDestroyed()) {
    adminPanelWindow.close();
  }
};

const getAdminPanelWindow = () => adminPanelWindow;

module.exports = {
  ensureAdminPanelWindow,
  closeAdminPanelWindow,
  getAdminPanelWindow,
  positionAdminPanelWindow,
};
