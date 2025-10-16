const { sanitizeSettings } = require('../settings');

const SETTINGS_KEYS = [
  'trayEnabled',
  'zoomOnClickEnabled',
  'autoPasteEnabled',
  'inputMode',
  'libraryTheme',
  'widgetTheme',
];

const serializePreferences = (value) => JSON.stringify(value ?? {});
const haveSettingsChanged = (previous, next) => {
  if (SETTINGS_KEYS.some((key) => previous[key] !== next[key])) {
    return true;
  }
  return serializePreferences(previous.preferences) !== serializePreferences(next.preferences);
};

const cloneSanitizedSettings = (value) => {
  const sanitized = sanitizeSettings(value);
  return {
    ...sanitized,
    preferences: { ...sanitized.preferences },
  };
};

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

  ipcMain.handle('settings:get', () => ({
    success: true,
    settings: cloneSanitizedSettings(getSettings()),
  }));

  ipcMain.handle('settings:update', (_event, payload = {}) => {
    const currentSettings = cloneSanitizedSettings(getSettings());
    const mergedSettings = cloneSanitizedSettings({
      ...currentSettings,
      ...(typeof payload === 'object' && payload ? payload : {}),
    });
    const changed = haveSettingsChanged(currentSettings, mergedSettings);
    const shouldApplyTray = currentSettings.trayEnabled !== mergedSettings.trayEnabled;

    if (changed) {
      setSettings(mergedSettings);
      if (shouldApplyTray) {
        applyTraySettings();
      }
      persistSettings();
      broadcastSettings();
    }

    return { success: true, settings: cloneSanitizedSettings(getSettings()) };
  });
};

module.exports = {
  registerSettingsHandlers,
};
