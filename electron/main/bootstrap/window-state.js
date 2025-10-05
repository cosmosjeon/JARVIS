let windowConfig = {
  frameless: true,
  transparent: true,
  alwaysOnTop: true,
  skipTaskbar: true,
};

const applyWindowConfigTo = (targetWindow) => {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  targetWindow.setAlwaysOnTop(windowConfig.alwaysOnTop, 'floating', 1);
  targetWindow.setSkipTaskbar(windowConfig.skipTaskbar);
  targetWindow.setMenuBarVisibility(!windowConfig.frameless);
};

const sendWindowState = (targetWindow, ipcChannel = 'window:state') => {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  try {
    targetWindow.webContents.send(ipcChannel, {
      maximized: targetWindow.isMaximized(),
      fullscreen: targetWindow.isFullScreen(),
      visible: targetWindow.isVisible(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[window-state] send failed', error?.message);
  }
};

module.exports = {
  windowConfig,
  applyWindowConfigTo,
  sendWindowState,
};
