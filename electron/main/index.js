process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_FILES = [
  '.env',
  '.env.local',
  '.env.electron',
  '.env.electron.local',
];

ENV_FILES.forEach((file, index) => {
  try {
    const resolvedPath = path.resolve(__dirname, '..', '..', file);
    if (!fs.existsSync(resolvedPath)) {
      return;
    }
    dotenv.config({
      path: resolvedPath,
      override: index > 0,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[electron] Failed to load ${file}:`, error?.message);
  }
});

const { start } = require('./bootstrap/appBootstrap');

module.exports = {
  start,
};

start();
