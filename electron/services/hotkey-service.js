const { globalShortcut } = require('electron');
const { createHotkeyManager } = require('../hotkeys');

const WIDGET_ACCELERATOR_MAP = {
  darwin: 'Command+1',
};

const DEFAULT_WIDGET_ACCELERATOR = WIDGET_ACCELERATOR_MAP[process.platform] || 'Alt+1';
const PASS_THROUGH_ACCELERATOR = 'CommandOrControl+2';

const createHotkeyService = ({ logger, toggleWidgetVisibility, ensureMainWindowFocus, getMainWindow }) => {
  let hotkeyManager;

  const registerPrimaryHotkey = () => {
    if (!hotkeyManager) {
      hotkeyManager = createHotkeyManager(logger);
    }
    hotkeyManager.unregisterAll?.();
    logger?.info?.('Primary hotkey registration disabled - Alt+` key removed');
    return true;
  };

  const registerWidgetToggleHotkey = () => {
    if (!hotkeyManager) {
      hotkeyManager = createHotkeyManager(logger);
      logger?.info?.('Hotkey manager created for widget toggle');
    }

    logger?.info?.(`Attempting to register ${DEFAULT_WIDGET_ACCELERATOR} hotkey for widget toggle`);

    const success = hotkeyManager.registerToggle({
      accelerator: DEFAULT_WIDGET_ACCELERATOR,
      handler: () => toggleWidgetVisibility(logger).visible,
    });

    if (success) {
      logger?.info?.('Widget toggle hotkey registered successfully', {
        accelerator: DEFAULT_WIDGET_ACCELERATOR,
        platform: process.platform,
        hotkeyManagerStatus: hotkeyManager.status,
      });
      return true;
    }

    logger?.error?.('Widget toggle hotkey registration failed', {
      accelerator: DEFAULT_WIDGET_ACCELERATOR,
      platform: process.platform,
      hotkeyManagerStatus: hotkeyManager.status,
    });

    logger?.info?.('Attempting direct globalShortcut registration as fallback');
    const directSuccess = globalShortcut.register(DEFAULT_WIDGET_ACCELERATOR, () => {
      toggleWidgetVisibility(logger);
    });

    if (directSuccess) {
      logger?.info?.('Direct globalShortcut registration successful');
    } else {
      logger?.error?.('Direct globalShortcut registration also failed');
    }

    return directSuccess;
  };

  const registerPassThroughShortcut = () => {
    const success = globalShortcut.register(PASS_THROUGH_ACCELERATOR, () => {
      ensureMainWindowFocus();
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      mainWindow.webContents.send('pass-through:toggle');
    });

    if (success) {
      logger?.info?.('Pass-through shortcut registered', { accelerator: PASS_THROUGH_ACCELERATOR });
    } else {
      logger?.warn?.('Failed to register pass-through shortcut', { accelerator: PASS_THROUGH_ACCELERATOR });
    }
  };

  const applyHotkeySettings = () => {
    registerPrimaryHotkey();
    registerWidgetToggleHotkey();
  };

  const dispose = () => {
    globalShortcut.unregister(PASS_THROUGH_ACCELERATOR);
    globalShortcut.unregister(DEFAULT_WIDGET_ACCELERATOR);
    hotkeyManager?.dispose?.();
    hotkeyManager = null;
  };

  return {
    applyHotkeySettings,
    registerPassThroughShortcut,
    registerWidgetToggleHotkey,
    dispose,
  };
};

module.exports = {
  createHotkeyService,
};
