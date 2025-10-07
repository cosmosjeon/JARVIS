const { registerSystemHandlers } = require('../ipc-handlers/system');
const { registerLogHandlers } = require('../ipc-handlers/logs');
const { registerAgentHandlers } = require('../ipc-handlers/agent');
const { registerSettingsHandlers } = require('../ipc-handlers/settings');
const { registerWindowHandlers } = require('../ipc-handlers/window');
const { registerLibraryHandlers } = require('../ipc-handlers/library');
const { registerAdminHandlers } = require('../ipc-handlers/admin');

const registerIpcHandlers = ({
  ipcMain,
  accessibility,
  logger,
  logs,
  llmService,
  settingsManager,
  hotkeyService,
  trayService,
  createLogBridge,
  screen,
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
  createLibraryWindow,
  getLibraryWindow,
  ensureAdminPanelWindow,
  closeAdminPanelWindow,
  positionAdminPanelWindow,
}) => {
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
    getSettings: () => settingsManager.getSettings(),
    setSettings: (next) => settingsManager.setSettings(next),
    applyHotkeySettings: () => hotkeyService.applyHotkeySettings(),
    applyTraySettings: () => trayService.applyTraySettings(settingsManager.getSettings()),
    persistSettings: () => settingsManager.persistSettings(),
    broadcastSettings: () => settingsManager.broadcastSettings(),
    defaultAccelerator: settingsManager.defaultAccelerator,
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
    getSettings: () => settingsManager.getSettings(),
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

module.exports = {
  registerIpcHandlers,
};
