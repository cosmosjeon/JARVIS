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

const loadedEnvFiles = [];

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
    loadedEnvFiles.push({ file, override: index > 0, path: resolvedPath });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[electron] Failed to load ${file}:`, error?.message);
  }
});

if (loadedEnvFiles.length) {
  // eslint-disable-next-line no-console
  console.info('[electron] Loaded environment files', loadedEnvFiles.map((entry) => ({
    file: entry.file,
    override: entry.override,
  })));
} else {
  // eslint-disable-next-line no-console
  console.warn('[electron] No environment files were loaded. Verify .env configuration.');
}

const { start } = require('./bootstrap/appBootstrap');

module.exports = {
  start,
};

start();
