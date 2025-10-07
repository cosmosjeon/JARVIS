const path = require('path');
const { BrowserWindow, desktopCapturer, screen } = require('electron');
const { getRendererUrl } = require('../main/bootstrap/renderer-url');

const findDisplayById = (displayId) => {
  const displays = screen.getAllDisplays();
  return displays.find((display) => display.id === displayId) || null;
};

const findSourceForDisplay = (sources, display) => {
  if (!display) {
    return null;
  }
  const displayIdString = String(display.id);
  return (
    sources.find((source) => source.display_id === displayIdString)
    || sources.find((source) => source.id.endsWith(displayIdString))
    || null
  );
};

const buildCaptureResultPayload = ({ image, rect, display }) => {
  if (!image || image.isEmpty()) {
    return null;
  }
  const buffer = image.toPNG();
  const base64 = buffer.toString('base64');
  return {
    base64,
    mimeType: 'image/png',
    width: rect?.width || image.getSize().width,
    height: rect?.height || image.getSize().height,
    displayId: display?.id || null,
    timestamp: Date.now(),
  };
};

const createCaptureService = ({
  logger,
  ensureMainWindowFocus,
  getMainWindow,
  getAllWidgetWindows,
}) => {
  let overlayWindow = null;
  let captureInProgress = false;
  let activeDisplay = null;

  const closeOverlayWindow = () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
    }
    overlayWindow = null;
    activeDisplay = null;
    captureInProgress = false;
  };

  const broadcast = (channel, payload) => {
    const windows = [getMainWindow(), ...getAllWidgetWindows()];
    windows.forEach((target) => {
      if (!target || target.isDestroyed()) {
        return;
      }
      try {
        target.webContents.send(channel, payload);
      } catch (error) {
        logger?.warn?.('capture_broadcast_failed', { channel, error: error?.message });
      }
    });
  };

  const dispatchCaptureResult = (result) => {
    if (!result) {
      return;
    }
    ensureMainWindowFocus?.();
    broadcast('capture-area:completed', result);
  };

  const createOverlayWindow = () => {
    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    activeDisplay = display;

    const overlay = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      show: false,
      frame: false,
      transparent: true,
      fullscreenable: false,
      resizable: false,
      skipTaskbar: true,
      focusable: true,
      alwaysOnTop: true,
      acceptFirstMouse: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
        devTools: process.env.NODE_ENV !== 'production',
      },
    });

    overlay.on('closed', () => {
      overlayWindow = null;
      activeDisplay = null;
      captureInProgress = false;
    });

    const overlayUrl = getRendererUrl('capture-overlay', {
      displayId: display.id,
      scale: display.scaleFactor,
      boundsX: display.bounds.x,
      boundsY: display.bounds.y,
    });

    logger?.info?.('capture_overlay_open', {
      url: overlayUrl,
      displayId: display.id,
      bounds: display.bounds,
      scaleFactor: display.scaleFactor,
    });

    overlay.loadURL(overlayUrl).catch((error) => {
      logger?.error?.('capture_overlay_load_failed', { message: error?.message });
      closeOverlayWindow();
    });

    overlay.once('ready-to-show', () => {
      overlay.showInactive();
      overlay.focus();
    });

    overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    overlayWindow = overlay;
    return overlay;
  };

  const requestCapture = async () => {
    if (captureInProgress) {
      logger?.warn?.('capture_request_ignored_busy');
      return { success: false, reason: 'busy' };
    }

    captureInProgress = true;
    createOverlayWindow();
    return { success: true };
  };

  const captureArea = async ({ displayId, rect = {} }) => {
    if (!captureInProgress) {
      logger?.warn?.('capture_perform_without_session');
    }

    try {
      const targetDisplay = findDisplayById(displayId) || activeDisplay || screen.getPrimaryDisplay();
      if (!targetDisplay) {
        throw new Error('display_not_found');
      }

      const requiredProps = ['x', 'y', 'width', 'height'];
      if (!requiredProps.every((key) => typeof rect[key] === 'number' && rect[key] > 0)) {
        throw new Error('invalid_rect');
      }

      const scaleFactor = rect.scaleFactor || targetDisplay.scaleFactor || 1;
      const thumbnailSize = {
        width: Math.ceil(targetDisplay.size?.width || targetDisplay.bounds.width * scaleFactor),
        height: Math.ceil(targetDisplay.size?.height || targetDisplay.bounds.height * scaleFactor),
      };

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize,
        fetchWindowIcons: false,
      });

      const source = findSourceForDisplay(sources, targetDisplay);
      if (!source || source.thumbnail.isEmpty()) {
        throw new Error('capture_source_not_found');
      }

      const maxWidth = Math.round(thumbnailSize.width);
      const maxHeight = Math.round(thumbnailSize.height);
      const cropRect = {
        x: Math.max(0, Math.round((rect.x) * scaleFactor)),
        y: Math.max(0, Math.round((rect.y) * scaleFactor)),
        width: Math.max(1, Math.round(rect.width * scaleFactor)),
        height: Math.max(1, Math.round(rect.height * scaleFactor)),
      };

      if (cropRect.x + cropRect.width > maxWidth) {
        cropRect.width = Math.max(1, maxWidth - cropRect.x);
      }
      if (cropRect.y + cropRect.height > maxHeight) {
        cropRect.height = Math.max(1, maxHeight - cropRect.y);
      }

      const cropped = source.thumbnail.crop(cropRect);
      if (!cropped || cropped.isEmpty()) {
        throw new Error('capture_crop_failed');
      }

      const result = buildCaptureResultPayload({ image: cropped, rect: cropRect, display: targetDisplay });
      dispatchCaptureResult(result);
      return { success: true, result };
    } catch (error) {
      logger?.error?.('capture_perform_failed', { message: error?.message });
      broadcast('capture-area:failed', { message: error?.message });
      return { success: false, error: error?.message || 'capture_failed' };
    } finally {
      closeOverlayWindow();
    }
  };

  const cancelCapture = () => {
    if (!captureInProgress) {
      return { success: true };
    }
    broadcast('capture-area:cancelled', { timestamp: Date.now() });
    closeOverlayWindow();
    return { success: true };
  };

  const dispose = () => {
    closeOverlayWindow();
  };

  return {
    requestCapture,
    captureArea,
    cancelCapture,
    dispose,
  };
};

module.exports = {
  createCaptureService,
};
