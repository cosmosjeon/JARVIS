const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const defaultSettings = {
  autoPasteEnabled: true,
  trayEnabled: true,
  zoomOnClickEnabled: true,
  inputMode: 'mouse',
  theme: 'light',
};

const readSettings = () => {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return { ...defaultSettings };
    }
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...defaultSettings,
      ...parsed,
    };
  } catch (error) {
    return { ...defaultSettings };
  }
};

const writeSettings = (settings) => {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (error) {
    return false;
  }
};

const createSettingsStore = () => {
  let current = readSettings();

  const get = () => current;
  const set = (next) => {
    current = { ...defaultSettings, ...next };
    return current;
  };
  const persist = () => writeSettings(current);

  return {
    get,
    set,
    persist,
  };
};

module.exports = {
  SETTINGS_FILE,
  defaultSettings,
  readSettings,
  writeSettings,
  createSettingsStore,
};
