process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const path = require('path');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('[electron] Failed to load .env file:', error?.message);
}

const { start } = require('./bootstrap/appBootstrap');

module.exports = {
  start,
};

start();
