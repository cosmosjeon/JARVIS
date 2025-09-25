const { globalShortcut } = require('electron');

module.exports = (logger) => ({
  register: ({ accelerator, handler }) => {
    if (!accelerator || typeof handler !== 'function') {
      logger?.warn?.('Fallback hotkey register called with invalid arguments', {
        accelerator,
      });
      return false;
    }
    const success = globalShortcut.register(accelerator, handler);
    if (!success) {
      logger?.warn?.('Fallback hotkey registration failed', { accelerator });
    }
    return success;
  },
  unregisterAll: () => {
    globalShortcut.unregisterAll();
  },
  dispose: () => {
    globalShortcut.unregisterAll();
    logger?.info?.('Fallback hotkey adapter disposed');
  },
});
