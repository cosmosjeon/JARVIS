const registerCaptureHandlers = ({ ipcMain, captureService }) => {
  if (!ipcMain || !captureService) {
    throw new Error('[ipc-handlers/capture] Missing required dependencies');
  }

  ipcMain.handle('capture-area:request', () => captureService.requestCapture());
  ipcMain.handle('capture-area:perform', (_event, payload) => captureService.captureArea(payload || {}));
  ipcMain.handle('capture-area:cancel', () => captureService.cancelCapture());
};

module.exports = {
  registerCaptureHandlers,
};
