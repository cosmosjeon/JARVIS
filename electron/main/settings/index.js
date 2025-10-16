const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

const normalizeBoolean = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

const INPUT_MODES = new Set(['mouse', 'trackpad']);
const normalizeInputMode = (value, fallback) => (
  typeof value === 'string' && INPUT_MODES.has(value) ? value : fallback
);

const LIBRARY_THEMES = new Set(['light', 'dark']);
const normalizeLibraryTheme = (value, fallback) => (
  typeof value === 'string' && LIBRARY_THEMES.has(value) ? value : fallback
);

const WIDGET_THEMES = new Set(['glass', 'light', 'dark']);
const normalizeWidgetTheme = (value, fallback) => (
  typeof value === 'string' && WIDGET_THEMES.has(value) ? value : fallback
);

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const sanitizePreferences = (value) => (isPlainObject(value) ? { ...value } : {});

const BASE_DEFAULTS = Object.freeze({
  trayEnabled: true,
  zoomOnClickEnabled: true,
  autoPasteEnabled: true,
  inputMode: 'mouse',
  libraryTheme: 'light',
  widgetTheme: 'glass',
  preferences: {},
});

const sanitizeSettings = (raw = {}) => {
  const source = isPlainObject(raw) ? raw : {};
  const libraryThemeSource = typeof source.libraryTheme === 'string' ? source.libraryTheme : source.theme;

  return {
    trayEnabled: normalizeBoolean(source.trayEnabled, BASE_DEFAULTS.trayEnabled),
    zoomOnClickEnabled: normalizeBoolean(
      source.zoomOnClickEnabled,
      BASE_DEFAULTS.zoomOnClickEnabled,
    ),
    autoPasteEnabled: normalizeBoolean(source.autoPasteEnabled, BASE_DEFAULTS.autoPasteEnabled),
    inputMode: normalizeInputMode(source.inputMode, BASE_DEFAULTS.inputMode),
    libraryTheme: normalizeLibraryTheme(libraryThemeSource, BASE_DEFAULTS.libraryTheme),
    widgetTheme: normalizeWidgetTheme(source.widgetTheme, BASE_DEFAULTS.widgetTheme),
    preferences: sanitizePreferences(
      typeof source.preferences === 'undefined' ? BASE_DEFAULTS.preferences : source.preferences,
    ),
  };
};

const defaultSettings = sanitizeSettings(BASE_DEFAULTS);

const readSettings = () => {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return { ...defaultSettings };
    }
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return sanitizeSettings(parsed);
  } catch (error) {
    return { ...defaultSettings };
  }
};

const writeSettings = (settings) => {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    const sanitized = sanitizeSettings(settings);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(sanitized, null, 2), 'utf-8');
    return true;
  } catch (error) {
    return false;
  }
};

const createSettingsStore = () => {
  let current = readSettings();

  const get = () => current;
  const set = (next) => {
    current = sanitizeSettings({ ...current, ...next });
    return current;
  };
  const replace = (next) => {
    current = sanitizeSettings(next);
    return current;
  };
  const reload = () => {
    current = readSettings();
    return current;
  };
  const persist = () => writeSettings(current);

  return {
    get,
    set,
    replace,
    reload,
    persist,
  };
};

module.exports = {
  SETTINGS_FILE,
  defaultSettings,
  readSettings,
  writeSettings,
  createSettingsStore,
  sanitizeSettings,
};
