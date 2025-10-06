const registerAdminHandlers = ({
  ipcMain,
  ensureAdminPanelWindow,
  closeAdminPanelWindow,
  screen,
  isDev,
  logger,
}) => {
  if (!ipcMain || !ensureAdminPanelWindow || !closeAdminPanelWindow) {
    throw new Error('[ipc-handlers/admin] Missing required dependencies');
  }

  ipcMain.handle('admin-panel:ensure', () => {
    const panel = ensureAdminPanelWindow({ screen, isDev, logger });
    if (!panel) {
      return { success: false, error: { code: 'panel_unavailable', message: '패널 창을 생성할 수 없습니다.' } };
    }
    return { success: true, windowId: panel.id };
  });

  ipcMain.handle('admin-panel:close', () => {
    closeAdminPanelWindow();
    return { success: true };
  });
};

module.exports = {
  registerAdminHandlers,
};
