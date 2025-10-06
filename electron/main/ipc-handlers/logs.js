const registerLogHandlers = ({
  ipcMain,
  logger,
  createLogBridge,
  getMainWindow,
  logs,
}) => {
  if (!ipcMain || !createLogBridge || !getMainWindow || !logs) {
    throw new Error('[ipc-handlers/logs] Missing required dependencies');
  }

  ipcMain.handle('logger:write', (_event, payload = {}) => {
    const { level = 'info', message = '', meta = {} } = payload || {};
    if (!message) {
      return { success: false, error: { code: 'invalid_log', message: 'message required' } };
    }

    const normalizedMeta = typeof meta === 'object' && meta !== null ? meta : {};
    const bridge = logger || createLogBridge(() => getMainWindow());
    if (typeof bridge[level] === 'function') {
      bridge[level](message, normalizedMeta);
    } else {
      bridge.info(message, normalizedMeta);
    }
    return { success: true };
  });

  ipcMain.handle('logs:export', (_event, payload = {}) => logs.exportLogs(payload));
};

module.exports = {
  registerLogHandlers,
};
