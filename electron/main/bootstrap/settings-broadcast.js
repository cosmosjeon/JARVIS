const broadcastSettings = (targetWindow, settings = {}) => {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  try {
    targetWindow.webContents.send('settings:changed', { ...settings });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[settings-broadcast] send failed', error?.message);
  }
};

module.exports = {
  broadcastSettings,
};
