const registerWindowHandlers = ({
  ipcMain,
  screen,
  logger,
  isDev,
  toggleWidgetVisibility,
  createMainWindow,
  createWidgetWindow,
  ensureMainWindowFocus,
  getWidgetSession,
  getMainWindow,
  getAllWidgetWindows,
  resolveBrowserWindowFromSender,
  windowConfig,
  applyWindowConfigTo,
  getSettings,
}) => {
  if (!ipcMain || !toggleWidgetVisibility || !createMainWindow || !createWidgetWindow || !getMainWindow) {
    throw new Error('[ipc-handlers/window] Missing required dependencies');
  }

  ipcMain.handle('window:toggleVisibility', () => {
    const visible = toggleWidgetVisibility(logger);
    return { success: true, visible };
  });

  ipcMain.handle('window:openWidget', (_event, payload = {}) => {
    const requestedTreeId = typeof payload?.treeId === 'string' && payload.treeId.trim()
      ? payload.treeId.trim()
      : null;
    const reusePrimary = Boolean(payload?.reusePrimary);
    const forceFresh = Boolean(payload?.fresh ?? !reusePrimary);
    const settings = getSettings();

    if (reusePrimary) {
      const { window: primaryWindow } = createMainWindow({
        logger,
        settings,
        treeId: requestedTreeId || null,
        fresh: forceFresh,
        isDev,
      });

      if (primaryWindow && !primaryWindow.isDestroyed()) {
        ensureMainWindowFocus();
        if (requestedTreeId) {
          primaryWindow.webContents.send('widget:set-active-tree', { treeId: requestedTreeId });
        }

        return {
          success: true,
          windowId: primaryWindow.id,
          reusedPrimary: true,
          sessionId: getWidgetSession(primaryWindow.id) || null,
        };
      }
    }

    const { window: newWindow, sessionId } = createWidgetWindow({
      logger,
      settings,
      treeId: requestedTreeId || null,
      fresh: forceFresh,
      isDev,
    });

    return {
      success: true,
      windowId: newWindow.id,
      reusedPrimary: false,
      sessionId,
    };
  });

  ipcMain.handle('window:control', (event, action) => {
    const currentWindow = resolveBrowserWindowFromSender(event.sender);
    if (!currentWindow) {
      return { success: false, error: { code: 'no_window', message: 'Current window not available' } };
    }

    switch (action) {
      case 'minimize':
        currentWindow.minimize();
        break;
      case 'maximize':
        if (currentWindow.isMaximized()) {
          currentWindow.unmaximize();
        } else {
          currentWindow.maximize();
        }
        break;
      case 'toggleFullScreen':
        currentWindow.setFullScreen(!currentWindow.isFullScreen());
        break;
      case 'close':
        currentWindow.close();
        break;
      default:
        return { success: false, error: { code: 'invalid_action', message: 'Unsupported window control action' } };
    }

    return {
      success: true,
      action,
      maximized: currentWindow.isMaximized(),
      fullscreen: currentWindow.isFullScreen(),
    };
  });

  ipcMain.handle('window:getState', (event) => {
    const fallback = getMainWindow();
    const targetWindow = resolveBrowserWindowFromSender(event.sender) || fallback;

    if (!targetWindow) {
      return { success: false, error: { code: 'no_window', message: 'Window not available' } };
    }

    return {
      success: true,
      state: {
        maximized: targetWindow.isMaximized(),
        fullscreen: targetWindow.isFullScreen(),
        visible: targetWindow.isVisible(),
      },
    };
  });

  ipcMain.handle('window:setMousePassthrough', (_event, payload = {}) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return { success: false, error: { code: 'no_window', message: 'Main window not available' } };
    }

    const ignore = typeof payload.ignore === 'boolean' ? payload.ignore : true;
    const forward = payload.forward !== false;

    try {
      const options = ignore && forward ? { forward: true } : undefined;
      mainWindow.setIgnoreMouseEvents(ignore, options);
      logger?.debug?.('window_mouse_passthrough_updated', { ignore, forward });
      return { success: true, ignore };
    } catch (error) {
      logger?.error?.('window_mouse_passthrough_failed', { message: error?.message });
      return {
        success: false,
        error: {
          code: 'set_ignore_failed',
          message: error?.message || 'Failed to update mouse passthrough state',
        },
      };
    }
  });

  ipcMain.handle('cursor:getRelativePosition', () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return { success: false, inside: false };
    }

    try {
      const cursorPoint = screen.getCursorScreenPoint();
      const bounds = mainWindow.getBounds();
      const inside = cursorPoint.x >= bounds.x
        && cursorPoint.x <= bounds.x + bounds.width
        && cursorPoint.y >= bounds.y
        && cursorPoint.y <= bounds.y + bounds.height;

      if (!inside) {
        return { success: true, inside: false };
      }

      return {
        success: true,
        inside: true,
        x: cursorPoint.x - bounds.x,
        y: cursorPoint.y - bounds.y,
      };
    } catch (error) {
      logger?.warn?.('cursor_position_failed', { message: error?.message });
      return { success: false, inside: false };
    }
  });

  ipcMain.handle('window:updateConfig', (_event, config = {}) => {
    Object.assign(windowConfig, {
      frameless: Boolean(config.frameless),
      transparent: Boolean(config.transparent),
      alwaysOnTop: Boolean(config.alwaysOnTop),
      skipTaskbar: Boolean(config.skipTaskbar),
    });

    getAllWidgetWindows().forEach((win) => applyWindowConfigTo(win));

    logger?.info?.('Window config updated', windowConfig);
    return windowConfig;
  });

  ipcMain.handle('window:resize', (event, payload = {}) => {
    const currentWindow = resolveBrowserWindowFromSender(event.sender);
    if (!currentWindow || currentWindow.isDestroyed()) {
      return { success: false, error: { code: 'no_window', message: 'Current window not available' } };
    }

    const { width, height, animate = true } = payload;

    if (typeof width !== 'number' || typeof height !== 'number') {
      return { success: false, error: { code: 'invalid_params', message: 'Width and height must be numbers' } };
    }

    try {
      const currentBounds = currentWindow.getBounds();

      // 새 트리 모드인지 확인 (URL 파라미터로 판단)
      const currentUrl = currentWindow.webContents.getURL();
      const isNewTreeMode = currentUrl.includes('fresh=1');
      
      const newWidth = Math.max(width, isNewTreeMode ? 320 : 320);
      const newHeight = Math.max(height, isNewTreeMode ? 120 : 240);

      // 좌상단 위치 고정, 오른쪽 아래로만 확장
      const newBounds = {
        x: currentBounds.x,
        y: currentBounds.y,
        width: newWidth,
        height: newHeight,
      };

      if (animate) {
        // 오른쪽 아래로 확장
        const duration = 1000; // 애니메이션 시간 (ms)
        const fps = 60;
        const frameTime = 1000 / fps; // ~16.67ms

        const widthDelta = newBounds.width - currentBounds.width;
        const heightDelta = newBounds.height - currentBounds.height;

        // easeOutExpo: 지수 감속으로 매우 부드럽고 우아함
        const easeOutExpo = (x) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x);

        const startTime = Date.now();
        const animateFrame = () => {
          if (currentWindow.isDestroyed()) return;

          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = easeOutExpo(progress);

          if (progress < 1) {
            const intermediateBounds = {
              x: currentBounds.x,
              y: currentBounds.y,
              width: Math.round(currentBounds.width + widthDelta * eased),
              height: Math.round(currentBounds.height + heightDelta * eased),
            };
            currentWindow.setBounds(intermediateBounds, false);
            setTimeout(animateFrame, frameTime);
          } else {
            // 최종 위치
            currentWindow.setBounds(newBounds, false);
          }
        };

        animateFrame();
      } else {
        currentWindow.setBounds(newBounds, false);
      }

      logger?.debug?.('window_resized', { width: newBounds.width, height: newBounds.height, animate });
      return { success: true, width: newBounds.width, height: newBounds.height };
    } catch (error) {
      logger?.error?.('window_resize_failed', { message: error?.message });
      return {
        success: false,
        error: {
          code: 'resize_failed',
          message: error?.message || 'Failed to resize window',
        },
      };
    }
  });
};

module.exports = {
  registerWindowHandlers,
};
