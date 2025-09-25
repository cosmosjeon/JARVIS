#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const distIndex = args.findIndex((arg) => arg === '--dist');
const timeoutIndex = args.findIndex((arg) => arg === '--timeout');
const binaryIndex = args.findIndex((arg) => arg === '--binary');

const distDir = distIndex !== -1 && args[distIndex + 1]
  ? path.resolve(process.cwd(), args[distIndex + 1])
  : path.resolve(process.cwd(), 'dist');

const timeoutMs = timeoutIndex !== -1 && args[timeoutIndex + 1]
  ? Number(args[timeoutIndex + 1])
  : Number(process.env.ELECTRON_SMOKE_TIMEOUT || 60000);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error('[smoke] Invalid timeout supplied');
  process.exit(2);
}

const packageJsonPath = path.resolve(__dirname, '..', '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const productName = (packageJson.build && packageJson.build.productName)
  || packageJson.productName
  || packageJson.name
  || 'app';

const normalize = (value) => value
  .replace(/[^a-zA-Z0-9\-_. ]/g, '')
  .trim();

const toBinaryCandidates = (baseName) => {
  const normalized = normalize(baseName);
  const dashed = normalized.toLowerCase().replace(/\s+/g, '-');
  const camel = normalized.replace(/\s+(\w)/g, (_, char) => char.toUpperCase());
  return [
    normalized,
    dashed,
    camel,
  ].filter(Boolean);
};

const resolveCandidates = () => {
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist directory not found at ${distDir}. Did you run electron-builder --dir?`);
  }

  const entries = fs.readdirSync(distDir, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    const fullPath = path.join(distDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.endsWith('-unpacked')) {
        candidates.push(fullPath);
      }
      if (entry.name.endsWith('.app')) {
        candidates.push(fullPath);
      }
    }
    if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.exe')) {
        candidates.push(fullPath);
      }
    }
  }
  return candidates;
};

const isExecutable = (filePath) => {
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      if (process.platform === 'win32') {
        return filePath.toLowerCase().endsWith('.exe');
      }
      return (stat.mode & 0o111) !== 0;
    }
  } catch (error) {
    return false;
  }
  return false;
};

const pickBinaryFromDir = (dirPath) => {
  if (process.platform === 'darwin' && dirPath.endsWith('.app')) {
    const macBinaryDir = path.join(dirPath, 'Contents', 'MacOS');
    if (!fs.existsSync(macBinaryDir)) return null;
    const files = fs.readdirSync(macBinaryDir);
    for (const file of files) {
      const candidate = path.join(macBinaryDir, file);
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  const names = toBinaryCandidates(productName);
  const files = fs.readdirSync(dirPath);
  for (const name of names) {
    const candidate = path.join(dirPath, name);
    if (isExecutable(candidate)) {
      return candidate;
    }
    const exeCandidate = process.platform === 'win32' ? `${candidate}.exe` : null;
    if (exeCandidate && isExecutable(exeCandidate)) {
      return exeCandidate;
    }
  }

  for (const file of files) {
    const candidate = path.join(dirPath, file);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
};

const findBinary = () => {
  if (binaryIndex !== -1 && args[binaryIndex + 1]) {
    return path.resolve(process.cwd(), args[binaryIndex + 1]);
  }

  const candidates = resolveCandidates();
  if (candidates.length === 0) {
    throw new Error(`No unpacked artifacts found under ${distDir}`);
  }

  for (const candidate of candidates) {
    if (fs.statSync(candidate).isFile()) {
      if (isExecutable(candidate)) {
        return candidate;
      }
      continue;
    }

    const binary = pickBinaryFromDir(candidate);
    if (binary) {
      return binary;
    }
  }
  throw new Error('Unable to locate platform executable. Pass --binary <path> to specify manually.');
};

const binaryPath = findBinary();

if (!fs.existsSync(binaryPath)) {
  console.error(`[smoke] Binary does not exist at ${binaryPath}`);
  process.exit(1);
}

console.log(`[smoke] Using executable: ${binaryPath}`);

const launchArgs = [];
if (process.platform === 'linux') {
  launchArgs.push('--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu-sandbox', '--no-zygote');
}

const child = spawn(binaryPath, launchArgs, {
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1',
    ELECTRON_ENABLE_STACK_DUMPING: '1',
    ELECTRON_SMOKE: '1',
    ELECTRON_DISABLE_SANDBOX: '1',
    QTWEBENGINE_CHROMIUM_FLAGS: `${process.env.QTWEBENGINE_CHROMIUM_FLAGS || ''} --no-sandbox`.trim(),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let resolved = false;
let collectedStdout = '';
let collectedStderr = '';
let timeoutHandle;

const shutdown = (code) => {
  if (resolved) return;
  resolved = true;
  clearTimeout(timeoutHandle);

  if (process.platform === 'win32') {
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 2000);
  } else {
    child.kill('SIGTERM');
  }

  if (code === 0) {
    console.log('[smoke] Success: main window reached ready state');
    process.exit(0);
  } else {
    console.error('[smoke] Failure: see output below');
    if (collectedStdout) {
      console.error('--- stdout ---');
      console.error(collectedStdout);
    }
    if (collectedStderr) {
      console.error('--- stderr ---');
      console.error(collectedStderr);
    }
    process.exit(code);
  }
};

child.on('error', (error) => {
  console.error(`[smoke] Failed to launch executable: ${error.message}`);
  shutdown(1);
});

child.stdout.on('data', (data) => {
  const text = data.toString();
  collectedStdout += text;
  process.stdout.write(`[electron] ${text}`);
  if (text.includes('Main window ready')) {
    shutdown(0);
  }
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  collectedStderr += text;
  process.stderr.write(`[electron:err] ${text}`);
});

child.on('close', (code) => {
  if (resolved) return;
  console.error(`[smoke] Process exited before success with code ${code}`);
  shutdown(code || 1);
});

timeoutHandle = setTimeout(() => {
  console.error(`[smoke] Timeout (${timeoutMs}ms) waiting for main window readiness`);
  shutdown(1);
}, timeoutMs);
