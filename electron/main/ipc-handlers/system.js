const registerSystemHandlers = ({ ipcMain, accessibility }) => {
  if (!ipcMain || !accessibility) {
    throw new Error('[ipc-handlers/system] Missing required dependencies');
  }

  ipcMain.handle('system:ping', () => 'pong');

  ipcMain.handle('system:accessibility:check', () => ({
    success: true,
    granted: accessibility.checkAccessibilityPermission(),
  }));

  ipcMain.handle('system:accessibility:request', () => {
    const result = accessibility.requestAccessibilityPermission();
    return { success: result.granted, ...result };
  });
};

module.exports = {
  registerSystemHandlers,
};
