#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(process.cwd(), 'build');
const indexHtmlPath = path.join(buildDir, 'index.html');
const manifestPath = path.join(buildDir, 'asset-manifest.json');

const ensureExists = (targetPath, description) => {
  if (!fs.existsSync(targetPath)) {
    console.error(`[web-smoke] Missing ${description} at ${targetPath}`);
    process.exit(1);
  }
};

const main = () => {
  ensureExists(buildDir, 'build directory');
  ensureExists(indexHtmlPath, 'index.html');
  ensureExists(manifestPath, 'asset-manifest.json');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entrypoints = Array.isArray(manifest.entrypoints) ? manifest.entrypoints : [];

  if (entrypoints.length === 0) {
    console.error('[web-smoke] asset-manifest.json has no entrypoints. Was the build successful?');
    process.exit(1);
  }

  console.log('[web-smoke] Build artifacts verified.');

  if ((process.env.REACT_APP_PLATFORM || '').toLowerCase() !== 'web') {
    console.warn('[web-smoke] REACT_APP_PLATFORM is not set to "web". Consider building with `npm run build:web`.');
  }

  console.log('[web-smoke] Smoke check passed.');
};

main();
