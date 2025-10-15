const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const {
  LOG_DIRECTORY,
  MAIN_LOG_FILE,
  MAX_LOG_SIZE_BYTES,
  RETENTION_DAYS,
} = require('./constants');

const ensureLogDirectory = () => {
  try {
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
  } catch (error) {
    // directory creation failures are non-fatal; electron-log will surface issues
  }
};

const removeExpiredLogs = () => {
  try {
    const entries = fs.readdirSync(LOG_DIRECTORY, { withFileTypes: true });
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith('app-') && entry.name.endsWith('.log'))
      .forEach((entry) => {
        try {
          const filePath = path.join(LOG_DIRECTORY, entry.name);
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs < cutoff) {
            fs.rmSync(filePath, { force: true });
          }
        } catch (error) {
          // swallow individual cleanup errors so logging keeps working
        }
      });
  } catch (error) {
    // ignore readdir errors to avoid breaking logging setup
  }
};

const guardConsoleTransport = () => {
  const transport = log?.transports?.console;
  if (!transport || typeof transport.writeFn !== 'function' || transport.__epipeGuarded) {
    return;
  }

  const write = transport.writeFn.bind(transport);
  transport.writeFn = (payload) => {
    try {
      write(payload);
    } catch (error) {
      if (error?.code === 'EPIPE') {
        transport.level = false;
        return;
      }
      throw error;
    }
  };

  transport.__epipeGuarded = true;
};

const configureTransport = () => {
  ensureLogDirectory();

  log.transports.file.resolvePathFn = () => MAIN_LOG_FILE;
  log.transports.file.maxSize = MAX_LOG_SIZE_BYTES;
  log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}';
  log.transports.console.level = 'info';
  guardConsoleTransport();

  log.transports.file.archiveLog = (oldLogPath) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveName = `app-${timestamp}.log`;
      const archivePath = path.join(LOG_DIRECTORY, archiveName);
      fs.renameSync(oldLogPath, archivePath);
    } catch (error) {
      try {
        fs.rmSync(oldLogPath, { force: true });
      } catch (removeError) {
        // swallow
      }
    }

    removeExpiredLogs();
  };
};

const sendToRenderer = (getWindow, payload) => {
  const target = typeof getWindow === 'function' ? getWindow() : null;
  if (!target || target.isDestroyed()) {
    return;
  }
  try {
    target.webContents.send('app:log', payload);
  } catch (error) {
    // ignore renderer delivery issues
  }
};

const createLogBridge = (getWindow) => {
  configureTransport();
  const scoped = log.scope('main');

  const forward = (level, message, meta) => {
    const payload = { level, message, meta, timestamp: Date.now() };
    sendToRenderer(getWindow, payload);
  };

  return {
    info: (message, meta) => {
      scoped.info(message, meta);
      forward('info', message, meta);
    },
    warn: (message, meta) => {
      scoped.warn(message, meta);
      forward('warn', message, meta);
    },
    error: (message, meta) => {
      scoped.error(message, meta);
      forward('error', message, meta);
    },
  };
};

module.exports = {
  createLogBridge,
  configureTransport,
  log,
};
