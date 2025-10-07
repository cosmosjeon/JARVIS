const registerSettingsHandlers = ({
  ipcMain,
  getSettings,
  setSettings,
  applyTraySettings,
  persistSettings,
  broadcastSettings,
}) => {
  if (!ipcMain || !getSettings || !setSettings || !applyTraySettings || !persistSettings || !broadcastSettings) {
    throw new Error('[ipc-handlers/settings] Missing required dependencies');
  }

  ipcMain.handle('settings:get', () => ({ success: true, settings: { ...getSettings() } }));

  ipcMain.handle('settings:update', (_event, payload = {}) => {
    const nextSettings = { ...getSettings() };
    let changed = false;
    let shouldApplyTray = false;

    if (typeof payload.trayEnabled === 'boolean' && payload.trayEnabled !== nextSettings.trayEnabled) {
      nextSettings.trayEnabled = payload.trayEnabled;
      changed = true;
      shouldApplyTray = true;
    }

    if (changed) {
      setSettings(nextSettings);
      if (shouldApplyTray) {
        applyTraySettings();
      }
      persistSettings();
      broadcastSettings();
    }

    return { success: true, settings: { ...getSettings() } };
  });
};

module.exports = {
  registerSettingsHandlers,
};
