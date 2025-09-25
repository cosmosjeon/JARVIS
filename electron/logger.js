const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');

const userDataPath = app.getPath('userData');
const logDir = path.join(userDataPath, 'logs');
const MAX_LOG_SIZE_BYTES = 1024 * 1024; // 1 MB
const RETENTION_DAYS = 7;

const ensureLogDir = () => {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (error) {
    // ignore directory creation errors; electron-log will surface issues later
  }
};

const cleanupOldLogs = () => {
  try {
    const entries = fs.readdirSync(logDir, { withFileTypes: true });
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith('app-') && entry.name.endsWith('.log'))
      .forEach((entry) => {
        try {
          const filePath = path.join(logDir, entry.name);
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs < cutoff) {
            fs.rmSync(filePath, { force: true });
          }
        } catch (error) {
          // swallow individual cleanup errors to avoid disrupting logging
        }
      });
  } catch (error) {
    // readdir failures are non-fatal for logging
  }
};

ensureLogDir();

log.transports.file.resolvePathFn = () => path.join(logDir, 'app.log');
log.transports.file.maxSize = MAX_LOG_SIZE_BYTES;
log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}';
log.transports.console.level = 'info';

log.transports.file.archiveLog = (oldLogPath) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `app-${timestamp}.log`;
    const archivePath = path.join(logDir, archiveName);

    fs.renameSync(oldLogPath, archivePath);
  } catch (error) {
    // fallback: if archive rename fails, attempt to remove original to keep logging flowing
    try {
      fs.rmSync(oldLogPath, { force: true });
    } catch (removeError) {
      // swallow
    }
  }

  cleanupOldLogs();
};

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
