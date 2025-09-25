const { app, globalShortcut } = require('electron');
const os = require('os');

const PLATFORM_MAP = {
  win32: './windows',
  darwin: './mac',
  linux: './linux',
};

const getAdapterModulePath = () => {
  const platform = process.platform;
  return PLATFORM_MAP[platform] || './fallback';
};

const createGlobalShortcutFallback = (logger) => ({
  register: ({ accelerator, handler }) => {
    if (!accelerator || typeof handler !== 'function') {
      return false;
    }
    const success = globalShortcut.register(accelerator, handler);
    if (!success) {
      logger?.warn?.('GlobalShortcut fallback registration failed', { accelerator });
    }
    return success;
  },
  unregisterAll: () => {
    globalShortcut.unregisterAll();
  },
  dispose: () => {
    globalShortcut.unregisterAll();
  },
});

const loadAdapter = (logger) => {
  const modulePath = getAdapterModulePath();
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const createAdapter = require(modulePath);
    return createAdapter(logger);
  } catch (error) {
    logger?.warn?.('Failed to load native hotkey adapter, using fallback', {
      modulePath,
      error: error?.message,
    });
    return createGlobalShortcutFallback(logger);
  }
};

const createHotkeyManager = (logger) => {
  let adapter;
  let registered = false;

  const ensureAdapter = () => {
    if (!adapter) {
      adapter = loadAdapter(logger);
    }
    return adapter;
  };

  const registerToggle = ({ accelerator, handler, options = {} }) => {
    if (!app.isReady()) {
      throw new Error('Cannot register hotkeys before app is ready');
    }

    const activeAdapter = ensureAdapter();
    const success = activeAdapter.register({ accelerator, handler, ...options });
    registered = registered || success;
    return success;
  };

  const unregisterAll = () => {
    if (!adapter) return;
    adapter.unregisterAll?.();
    registered = false;
  };

  const dispose = () => {
    try {
      adapter?.dispose?.();
    } finally {
      adapter = null;
      registered = false;
    }
  };

  return {
    registerToggle,
    unregisterAll,
    dispose,
    get status() {
      return {
        registered,
        platform: process.platform,
        hostname: os.hostname(),
      };
    },
  };
};

module.exports = {
  createHotkeyManager,
};
