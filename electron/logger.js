const path = require('path');
const { app } = require('electron');
const log = require('electron-log');

const userDataPath = app.getPath('userData');
const logDir = path.join(userDataPath, 'logs');

log.transports.file.resolvePathFn = () => path.join(logDir, 'app.log');
log.transports.file.maxSize = 1024 * 512; // 512 KB, rotation stub (TODO: configurable)
log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}';
log.transports.console.level = 'info';

const mainLogger = log.scope('main');

const sendToRenderer = (window, payload) => {
  if (!window) return;
  try {
    window.webContents.send('app:log', payload);
  } catch (error) {
    // ignore renderer delivery issues
  }
};

const createLogBridge = (getWindow) => ({
  info: (message, meta) => {
    mainLogger.info(message, meta);
    sendToRenderer(getWindow(), { level: 'info', message, meta, timestamp: Date.now() });
  },
  warn: (message, meta) => {
    mainLogger.warn(message, meta);
    sendToRenderer(getWindow(), { level: 'warn', message, meta, timestamp: Date.now() });
  },
  error: (message, meta) => {
    mainLogger.error(message, meta);
    sendToRenderer(getWindow(), { level: 'error', message, meta, timestamp: Date.now() });
  },
});

module.exports = {
  createLogBridge,
  log,
};
