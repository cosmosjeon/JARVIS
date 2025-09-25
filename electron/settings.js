const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

const defaultAccelerator = process.platform === 'darwin' ? 'Command+Shift+J' : 'Control+Shift+J';

const defaultSettings = {
  doubleCtrlEnabled: process.platform === 'win32',
  autoPasteEnabled: true,
  trayEnabled: true,
  accelerator: defaultAccelerator,
};

const normalizeAccelerator = (value) => {
  if (typeof value !== 'string') {
    return defaultAccelerator;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : defaultAccelerator;
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

module.exports = {
  defaultAccelerator,
  SETTINGS_FILE,
  defaultSettings,
  readSettings,
  writeSettings,
};
