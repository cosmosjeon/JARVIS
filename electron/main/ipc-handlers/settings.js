const registerSettingsHandlers = ({
  ipcMain,
  getSettings,
  setSettings,
  applyHotkeySettings,
  applyTraySettings,
  persistSettings,
  broadcastSettings,
  defaultAccelerator,
}) => {
  if (!ipcMain || !getSettings || !setSettings || !applyHotkeySettings || !applyTraySettings || !persistSettings || !broadcastSettings) {
    throw new Error('[ipc-handlers/settings] Missing required dependencies');
  }

  ipcMain.handle('settings:get', () => ({ success: true, settings: { ...getSettings() } }));

  ipcMain.handle('settings:update', (_event, payload = {}) => {
    const nextSettings = { ...getSettings() };
    let changed = false;
    let shouldApplyHotkeys = false;
    let shouldApplyTray = false;

    if (typeof payload.doubleCtrlEnabled === 'boolean' && payload.doubleCtrlEnabled !== nextSettings.doubleCtrlEnabled) {
      nextSettings.doubleCtrlEnabled = payload.doubleCtrlEnabled;
      changed = true;
      shouldApplyHotkeys = true;
    }

    if (typeof payload.trayEnabled === 'boolean' && payload.trayEnabled !== nextSettings.trayEnabled) {
      nextSettings.trayEnabled = payload.trayEnabled;
      changed = true;
      shouldApplyTray = true;
    }

    if (typeof payload.accelerator === 'string') {
      const normalized = payload.accelerator.trim();
      if (normalized && normalized !== nextSettings.accelerator) {
        nextSettings.accelerator = normalized;
        changed = true;
        shouldApplyHotkeys = true;
      }
    } else if (payload.accelerator === null && nextSettings.accelerator !== defaultAccelerator) {
      nextSettings.accelerator = defaultAccelerator;
      changed = true;
      shouldApplyHotkeys = true;
    }

    if (changed) {
      setSettings(nextSettings);
      if (shouldApplyHotkeys) {
        applyHotkeySettings();
      }
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
