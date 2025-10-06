const { createTray } = require('../tray');

const createTrayService = ({ logger, toggleWidgetVisibility, getMainWindow, ensureMainWindowFocus, app }) => {
  let tray;

  const toggleFromTray = () => {
    const result = toggleWidgetVisibility(logger);
    return { visible: result.visible };
  };

  const ensureTray = () => {
    if (!tray) {
      tray = createTray({
        getWindow: () => getMainWindow(),
        onToggle: toggleFromTray,
        onShowSettings: () => {
          logger?.info?.('Settings placeholder invoked from tray');
          toggleWidgetVisibility(logger);
        },
        onQuit: () => app.quit(),
        logger,
      });
    }
    return tray;
  };

  const applyTraySettings = (settings) => {
    if (!logger) {
      return;
    }

    if (settings.trayEnabled) {
      const instance = ensureTray();
      instance.create();
      instance.updateMenu();
    } else if (tray) {
      tray.dispose();
      tray = null;
    }
  };

  const dispose = () => {
    if (tray) {
      tray.dispose();
      tray = null;
    }
  };

  return {
    applyTraySettings,
    dispose,
  };
};

module.exports = {
  createTrayService,
};
