const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_ACCELERATOR = process.platform === 'darwin' ? 'Command+1' : 'Control+Shift+J';

const defaultSettings = {
  doubleCtrlEnabled: process.platform === 'win32',
  autoPasteEnabled: true,
  trayEnabled: true,
  accelerator: DEFAULT_ACCELERATOR,
};

const normalizeAccelerator = (value) => {
  if (typeof value !== 'string') {
    return DEFAULT_ACCELERATOR;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_ACCELERATOR;
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
      accelerator: normalizeAccelerator(parsed.accelerator),
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
    current = { ...defaultSettings, ...next, accelerator: normalizeAccelerator(next.accelerator) };
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
  DEFAULT_ACCELERATOR,
  defaultSettings,
  readSettings,
  writeSettings,
  createSettingsStore,
};
