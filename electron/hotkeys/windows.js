const { globalShortcut } = require('electron');

module.exports = (logger) => {
  const scopedHandlers = new Map();

  const register = ({ accelerator, handler }) => {
    if (!accelerator || typeof handler !== 'function') {
      logger?.warn?.('Windows hotkey register: invalid params', { accelerator });
      return false;
    }

    const wrappedHandler = () => {
      try {
        handler();
      } catch (error) {
        logger?.error?.('Windows hotkey handler failed', { error: error?.message });
      }
    };

    const success = globalShortcut.register(accelerator, wrappedHandler);
    if (success) {
      scopedHandlers.set(accelerator, wrappedHandler);
      logger?.info?.('Windows hotkey registered', { accelerator });
    } else {
      logger?.warn?.('Windows hotkey registration failed, falling back to globalShortcut', { accelerator });
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
