const { app, BrowserWindow, globalShortcut } = require('electron');

const DOUBLE_CTRL_THRESHOLD_MS = 450;

module.exports = (logger) => {
  const scopedHandlers = new Map();

  const register = ({ accelerator, handler, enableDoubleCtrl = false }) => {
    if (!accelerator || typeof handler !== 'function') {
      logger?.warn?.('Windows hotkey register: invalid params', { accelerator });
      return false;
    }

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
        handler();
      } catch (error) {
        logger?.error?.('Windows hotkey handler failed', { error: error?.message });
      }
    };

    let detachDoubleCtrlListeners;

    if (enableDoubleCtrl) {
      logger?.info?.('Windows double Ctrl PoC mode enabled');
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
            wrappedHandler();
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

      detachDoubleCtrlListeners = () => {
        attachedContents.forEach((contents) => {
          contents.removeListener('before-input-event', beforeInputHandler);
        });
        attachedContents.clear();
        app.removeListener('browser-window-created', onWindowCreated);
      };
    }

    const success = globalShortcut.register(accelerator, wrappedHandler);
    if (success) {
      scopedHandlers.set(accelerator, { handler: wrappedHandler, detach: detachDoubleCtrlListeners });
      logger?.info?.('Windows hotkey registered', { accelerator, enableDoubleCtrl });
      return true;
    }

    if (enableDoubleCtrl) {
      logger?.warn?.('Windows hotkey accelerator failed; relying on double Ctrl listeners only', { accelerator });
      scopedHandlers.set(accelerator, { handler: wrappedHandler, detach: detachDoubleCtrlListeners });
      return true;
    }

    logger?.warn?.('Windows hotkey registration failed, falling back to globalShortcut only', { accelerator });
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
