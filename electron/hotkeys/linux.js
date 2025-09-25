const { globalShortcut } = require('electron');

const isWayland = () => {
  return process.env.XDG_SESSION_TYPE === 'wayland';
};

module.exports = (logger) => {
  const scopedHandlers = new Map();

  const register = ({ accelerator, handler }) => {
    if (!accelerator || typeof handler !== 'function') {
      logger?.warn?.('Linux hotkey register: invalid params', { accelerator });
      return false;
    }

    if (isWayland()) {
      logger?.warn?.('Wayland environment detected; relying on globalShortcut fallback', {
        accelerator,
      });
    }

    const wrappedHandler = () => {
      try {
        handler();
      } catch (error) {
        logger?.error?.('Linux hotkey handler failed', { error: error?.message });
      }
    };

    const success = globalShortcut.register(accelerator, wrappedHandler);
    if (success) {
      scopedHandlers.set(accelerator, wrappedHandler);
      logger?.info?.('Linux hotkey registered', { accelerator });
    } else {
      logger?.warn?.('Linux hotkey registration failed', { accelerator });
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
