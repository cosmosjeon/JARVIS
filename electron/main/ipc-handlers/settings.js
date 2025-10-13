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

    if (typeof payload.zoomOnClickEnabled === 'boolean' && payload.zoomOnClickEnabled !== nextSettings.zoomOnClickEnabled) {
      nextSettings.zoomOnClickEnabled = payload.zoomOnClickEnabled;
      changed = true;
    }

    if (typeof payload.autoPasteEnabled === 'boolean' && payload.autoPasteEnabled !== nextSettings.autoPasteEnabled) {
      nextSettings.autoPasteEnabled = payload.autoPasteEnabled;
      changed = true;
    }

    if (typeof payload.inputMode === 'string' && payload.inputMode !== nextSettings.inputMode) {
      nextSettings.inputMode = payload.inputMode;
      changed = true;
    }

    if (typeof payload.theme === 'string' && payload.theme !== nextSettings.theme) {
      nextSettings.theme = payload.theme;
      changed = true;
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
