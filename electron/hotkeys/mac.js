const { globalShortcut, systemPreferences } = require('electron');

const hasAccessibilityPermission = () => {
  if (process.platform !== 'darwin' || typeof systemPreferences?.isTrustedAccessibilityClient !== 'function') {
    return true;
  }
  try {
    return systemPreferences.isTrustedAccessibilityClient(false);
  } catch (error) {
    return false;
  }
};

module.exports = (logger) => {
  const scopedHandlers = new Map();

  const register = ({ accelerator, handler }) => {
    if (!accelerator || typeof handler !== 'function') {
      logger?.warn?.('macOS hotkey register: invalid params', { accelerator });
      return false;
    }

    if (!hasAccessibilityPermission()) {
      logger?.warn?.('macOS accessibility permission missing; falling back to globalShortcut', { accelerator });
    }

    const wrappedHandler = () => {
      try {
        handler();
      } catch (error) {
        logger?.error?.('macOS hotkey handler failed', { error: error?.message });
      }
    };

    const success = globalShortcut.register(accelerator, wrappedHandler);
    if (success) {
      scopedHandlers.set(accelerator, wrappedHandler);
      logger?.info?.('macOS hotkey registered', { accelerator });
    } else {
      logger?.warn?.('macOS hotkey registration failed', { accelerator });
    }
    return success;
  };

  const unregisterAll = () => {
    scopedHandlers.forEach((_, accelerator) => {
      globalShortcut.unregister(accelerator);
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
