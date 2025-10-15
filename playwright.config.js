const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests/playwright'),
  timeout: 240_000,
  expect: {
    timeout: 90_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
});
