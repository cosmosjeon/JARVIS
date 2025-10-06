const path = require('path');
const { app } = require('electron');

const userDataPath = app.getPath('userData');

const LOG_DIRECTORY = path.join(userDataPath, 'logs');
const MAIN_LOG_FILE = path.join(LOG_DIRECTORY, 'app.log');
const MAX_LOG_SIZE_BYTES = 1024 * 1024; // 1 MB
const RETENTION_DAYS = 7;

module.exports = {
  LOG_DIRECTORY,
  MAIN_LOG_FILE,
  MAX_LOG_SIZE_BYTES,
  RETENTION_DAYS,
};
