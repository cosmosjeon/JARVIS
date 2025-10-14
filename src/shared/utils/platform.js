const RUNTIME_ELECTRON = 'electron';
const RUNTIME_WEB = 'web';
const RUNTIME_UNKNOWN = 'unknown';

const normalizeRuntime = (value) => {
  if (value === RUNTIME_ELECTRON || value === RUNTIME_WEB) {
    return value;
  }
  return RUNTIME_UNKNOWN;
};

const detectRuntimeFromEnv = () => {
  if (typeof process === 'undefined') {
    return null;
  }

  const platform = process.env.REACT_APP_PLATFORM || process.env.PLATFORM;
  if (platform) {
    const normalized = platform.toLowerCase();
    if (normalized === RUNTIME_ELECTRON) {
      return RUNTIME_ELECTRON;
    }
    if (normalized === RUNTIME_WEB || normalized === 'browser') {
      return RUNTIME_WEB;
    }
  }

  return null;
};

const detectRuntimeFromWindow = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (typeof window.jarvisAPI !== 'undefined') {
    return RUNTIME_ELECTRON;
  }

  if (window.process?.versions?.electron) {
    return RUNTIME_ELECTRON;
  }

  if (/Electron/i.test(window.navigator?.userAgent || '')) {
    return RUNTIME_ELECTRON;
  }

  return RUNTIME_WEB;
};

const detectRuntimeFromProcess = () => {
  if (typeof process === 'undefined') {
    return null;
  }

  if (process?.versions?.electron) {
    return RUNTIME_ELECTRON;
  }

  return null;
};

export const getRuntime = () => {
  const fromEnv = detectRuntimeFromEnv();
  if (fromEnv) {
    return normalizeRuntime(fromEnv);
  }

  const fromWindow = detectRuntimeFromWindow();
  if (fromWindow) {
    return normalizeRuntime(fromWindow);
  }

  const fromProcess = detectRuntimeFromProcess();
  if (fromProcess) {
    return normalizeRuntime(fromProcess);
  }

  return RUNTIME_UNKNOWN;
};

export const isElectron = () => getRuntime() === RUNTIME_ELECTRON;
export const isWeb = () => {
  const runtime = getRuntime();
  return runtime === RUNTIME_WEB || runtime === RUNTIME_UNKNOWN;
};

export const getRuntimeLabel = () => {
  const runtime = getRuntime();
  if (runtime === RUNTIME_UNKNOWN) {
    return RUNTIME_WEB;
  }
  return runtime;
};

export const constants = Object.freeze({
  RUNTIME_ELECTRON,
  RUNTIME_WEB,
  RUNTIME_UNKNOWN,
});

export default {
  getRuntime,
  isElectron,
  isWeb,
  getRuntimeLabel,
  constants,
};
