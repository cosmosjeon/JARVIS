const registerLibraryHandlers = ({ ipcMain, createLibraryWindow, getLibraryWindow, logger, isDev }) => {
  if (!ipcMain || !createLibraryWindow || !getLibraryWindow) {
    throw new Error('[ipc-handlers/library] Missing required dependencies');
  }

  ipcMain.handle('library:show', () => {
    const window = createLibraryWindow({ isDev, logger });
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.show();
      window.focus();
      return { success: true, windowId: window.id };
    }

    return { success: false, error: { code: 'library_unavailable', message: '라이브러리 창을 열 수 없습니다.' } };
  });

  ipcMain.handle('library:request-refresh', () => {
    const libraryWindow = getLibraryWindow();
    if (libraryWindow && !libraryWindow.isDestroyed()) {
      libraryWindow.webContents.send('library:refresh');
      return { success: true, delivered: true };
    }

    return { success: true, delivered: false };
  });
};

module.exports = {
  registerLibraryHandlers,
};
