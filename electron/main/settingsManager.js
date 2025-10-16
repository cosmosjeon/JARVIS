const settingsStoreModule = require('./settings');

const createSettingsManager = ({ getLogger, broadcastSettingsToWidgets, getLibraryWindow }) => {
  const settingsStore = settingsStoreModule.createSettingsStore();
  let settings = settingsStore.get();

  const loadSettings = () => {
    settings = settingsStore.reload();
    return settings;
  };

  const persistSettings = () => {
    const success = settingsStore.persist();
    if (!success) {
      getLogger?.()?.warn?.('Failed to persist settings');
    }
    return success;
  };

  const setSettings = (next) => {
    if (!next || typeof next !== 'object') {
      return settings;
    }
    settings = settingsStore.set(next);
    return settings;
  };

  const getSettings = () => settings;

  const broadcastSettings = () => {
    broadcastSettingsToWidgets(settings);
    const libraryWindow = getLibraryWindow();
    if (libraryWindow && !libraryWindow.isDestroyed()) {
      libraryWindow.webContents.send('settings:changed', { ...settings });
    }
  };

  return {
    loadSettings,
    persistSettings,
    setSettings,
    getSettings,
    broadcastSettings,
    settingsStore,
  };
};

module.exports = {
  createSettingsManager,
};
