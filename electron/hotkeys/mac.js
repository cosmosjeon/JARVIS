const { globalShortcut, systemPreferences, shell } = require('electron');

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

const ensureAccessibilityPermission = ({ prompt = false } = {}) => {
  if (process.platform !== 'darwin' || typeof systemPreferences?.isTrustedAccessibilityClient !== 'function') {
    return true;
  }
  try {
    const trusted = systemPreferences.isTrustedAccessibilityClient(prompt);
    if (!trusted && prompt) {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    }
    return trusted;
  } catch (error) {
    return false;
  }
};

module.exports = (logger) => {
  const scopedHandlers = new Map();

  const register = ({ accelerator, handler, enableDoubleCtrl = false, promptForPermission = false }) => {
    if (!accelerator || typeof handler !== 'function') {
      logger?.warn?.('macOS hotkey register: invalid params', { accelerator });
      return false;
    }

    const hasPermission = promptForPermission
      ? ensureAccessibilityPermission({ prompt: true })
      : hasAccessibilityPermission();

    if (!hasPermission) {
      logger?.warn?.('macOS accessibility permission missing; hotkey may not work until granted', { accelerator });
    }

    if (enableDoubleCtrl) {
      logger?.info?.('macOS double Ctrl requested but not implemented yet; using accelerator fallback', { accelerator });
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
    ensureAccessibilityPermission,
  };
};
