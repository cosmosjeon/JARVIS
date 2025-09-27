const { app, BrowserWindow, globalShortcut } = require('electron');

const DOUBLE_CTRL_THRESHOLD_MS = 450;
const CTRL_KEYCODES = new Set([29, 3613]);
const CTRL_RAWCODES = new Set([17, 162, 163]);

let ioHook;
let ioHookAvailable = false;
let ioHookStarted = false;
let ioHookUsageCount = 0;

try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  ioHook = require('iohook');
  ioHookAvailable = Boolean(ioHook);
} catch (error) {
  ioHookAvailable = false;
}

const beginIoHook = (logger) => {
  if (!ioHookAvailable) {
    return false;
  }
  if (!ioHookStarted) {
    try {
      ioHook.start();
      ioHookStarted = true;
      logger?.info?.('iohook started for double Ctrl detection');
    } catch (error) {
      logger?.warn?.('Failed to start iohook; double Ctrl will fall back to window listeners', {
        error: error?.message,
      });
      return false;
    }
  }
  ioHookUsageCount += 1;
  return true;
};

const endIoHook = (logger) => {
  if (!ioHookAvailable) {
    return;
  }
  ioHookUsageCount = Math.max(0, ioHookUsageCount - 1);
  if (ioHookUsageCount === 0 && ioHookStarted) {
    try {
      ioHook.stop();
      logger?.info?.('iohook stopped after releasing double Ctrl detection');
    } catch (error) {
      logger?.warn?.('Failed to stop iohook cleanly', { error: error?.message });
    } finally {
      ioHookStarted = false;
    }
  }
};

const isCtrlKeyEvent = (event) => {
  if (!event) return false;
  if (CTRL_KEYCODES.has(event.keycode)) {
    return true;
  }
  if (CTRL_RAWCODES.has(event.rawcode)) {
    return true;
  }
  if (event.ctrlKey === true && event.type === 'keydown') {
    return true;
  }
  return false;
};

const createIoHookDoubleCtrlDetector = (wrappedHandler, logger) => {
  if (!ioHookAvailable) {
    logger?.info?.('iohook not available; using renderer before-input fallback for double Ctrl');
    return null;
  }

  const ctrlKeyDownTimestamps = [];

  const detectDoubleCtrl = () => {
    if (ctrlKeyDownTimestamps.length < 2) {
      return false;
    }
    const first = ctrlKeyDownTimestamps[ctrlKeyDownTimestamps.length - 2];
    const second = ctrlKeyDownTimestamps[ctrlKeyDownTimestamps.length - 1];
    return second - first <= DOUBLE_CTRL_THRESHOLD_MS;
  };

  const keydownListener = (event) => {
    if (!isCtrlKeyEvent(event)) {
      return;
    }
    const now = Date.now();
    ctrlKeyDownTimestamps.push(now);
    if (ctrlKeyDownTimestamps.length > 2) {
      ctrlKeyDownTimestamps.shift();
    }
    if (detectDoubleCtrl()) {
      ctrlKeyDownTimestamps.length = 0;
      try {
        wrappedHandler();
      } catch (error) {
        logger?.error?.('Windows iohook double Ctrl handler failed', { error: error?.message });
      }
    }
  };

  try {
    ioHook.on('keydown', keydownListener);
  } catch (error) {
    logger?.warn?.('Failed to attach iohook listener; falling back to renderer detection', {
      error: error?.message,
    });
    return null;
  }

  if (!beginIoHook(logger)) {
    try {
      if (typeof ioHook.off === 'function') {
        ioHook.off('keydown', keydownListener);
      } else {
        ioHook.removeListener('keydown', keydownListener);
      }
    } catch (error) {
      logger?.warn?.('Failed to remove iohook listener after start failure', { error: error?.message });
    }
    return null;
  }

  logger?.info?.('Windows double Ctrl using iohook global listener');

  return () => {
    try {
      if (typeof ioHook.off === 'function') {
        ioHook.off('keydown', keydownListener);
      } else {
        ioHook.removeListener('keydown', keydownListener);
      }
    } catch (error) {
      logger?.warn?.('Failed to detach iohook listener', { error: error?.message });
    }
    endIoHook(logger);
  };
};

const createWindowDoubleCtrlDetector = (wrappedHandler, logger) => {
  logger?.info?.('Windows double Ctrl falling back to focused window listener');

  const ctrlKeyDownTimestamps = [];
  const attachedContents = new Set();

  const detectDoubleCtrl = () => {
    if (ctrlKeyDownTimestamps.length < 2) {
      return false;
    }
    const first = ctrlKeyDownTimestamps[ctrlKeyDownTimestamps.length - 2];
    const second = ctrlKeyDownTimestamps[ctrlKeyDownTimestamps.length - 1];
    return second - first <= DOUBLE_CTRL_THRESHOLD_MS;
  };

  const beforeInputHandler = (_event, input) => {
    if (input?.key !== 'Control') {
      return;
    }
    if (input.type === 'keyDown') {
      if (input.isAutoRepeat) {
        return;
      }
      const now = Date.now();
      ctrlKeyDownTimestamps.push(now);
      if (ctrlKeyDownTimestamps.length > 2) {
        ctrlKeyDownTimestamps.shift();
      }
      if (detectDoubleCtrl()) {
        ctrlKeyDownTimestamps.length = 0;
        try {
          wrappedHandler();
        } catch (error) {
          logger?.error?.('Windows window double Ctrl handler failed', { error: error?.message });
        }
      }
    }
  };

  const attachToContents = (contents) => {
    if (!contents || attachedContents.has(contents)) {
      return;
    }
    contents.on('before-input-event', beforeInputHandler);
    attachedContents.add(contents);
  };

  BrowserWindow.getAllWindows().forEach((window) => {
    attachToContents(window.webContents);
  });

  const onWindowCreated = (_event, window) => {
    attachToContents(window.webContents);
  };

  app.on('browser-window-created', onWindowCreated);

  return () => {
    attachedContents.forEach((contents) => {
      contents.removeListener('before-input-event', beforeInputHandler);
    });
    attachedContents.clear();
    app.removeListener('browser-window-created', onWindowCreated);
  };
};

module.exports = (logger) => {
  const scopedHandlers = new Map();

  const register = ({ accelerator, handler, enableDoubleCtrl = false }) => {
    if (!accelerator || typeof handler !== 'function') {
      logger?.warn?.('Windows hotkey register: invalid params', { accelerator });
      return false;
    }

    logger?.info?.('Windows hotkey register: attempting to register', {
      accelerator,
      enableDoubleCtrl,
      existingHandlers: scopedHandlers.size
    });

    const existing = scopedHandlers.get(accelerator);
    if (existing) {
      logger?.info?.('Windows hotkey re-registering existing accelerator, cleaning up previous listeners', {
        accelerator,
      });
      globalShortcut.unregister(accelerator);
      existing?.detach?.();
      scopedHandlers.delete(accelerator);
    }

    const wrappedHandler = () => {
      try {
        logger?.info?.('Windows hotkey handler triggered', { accelerator });
        handler();
      } catch (error) {
        logger?.error?.('Windows hotkey handler failed', { error: error?.message, accelerator });
      }
    };

    let detachDoubleCtrlListeners;
    let doubleCtrlMode = 'disabled';

    if (enableDoubleCtrl) {
      detachDoubleCtrlListeners = createIoHookDoubleCtrlDetector(wrappedHandler, logger);
      if (detachDoubleCtrlListeners) {
        doubleCtrlMode = 'iohook';
      } else {
        detachDoubleCtrlListeners = createWindowDoubleCtrlDetector(wrappedHandler, logger);
        if (detachDoubleCtrlListeners) {
          doubleCtrlMode = 'window';
        }
      }
    }

    const success = globalShortcut.register(accelerator, wrappedHandler);
    if (success) {
      scopedHandlers.set(accelerator, { handler: wrappedHandler, detach: detachDoubleCtrlListeners });
      logger?.info?.('Windows hotkey registered successfully', {
        accelerator,
        enableDoubleCtrl,
        doubleCtrlMode,
        totalRegistered: scopedHandlers.size
      });
      return true;
    }

    logger?.warn?.('Windows hotkey globalShortcut.register failed', {
      accelerator,
      enableDoubleCtrl,
      doubleCtrlMode,
      error: 'globalShortcut.register returned false'
    });

    if (enableDoubleCtrl) {
      logger?.warn?.('Windows hotkey accelerator registration failed; relying on double Ctrl listeners only', {
        accelerator,
        doubleCtrlMode,
      });
      scopedHandlers.set(accelerator, { handler: wrappedHandler, detach: detachDoubleCtrlListeners });
      return Boolean(detachDoubleCtrlListeners);
    }

    logger?.error?.('Windows hotkey registration failed and no double Ctrl listeners enabled', {
      accelerator,
      reason: 'globalShortcut.register failed and no fallback available'
    });
    return false;
  };

  const unregisterAll = () => {
    scopedHandlers.forEach((data, accelerator) => {
      globalShortcut.unregister(accelerator);
      data?.detach?.();
    });
    scopedHandlers.clear();
  };

  const dispose = () => {
    unregisterAll();
  };

  return {
    register,
    unregisterAll,
    dispose,
  };
};
