const path = require('path');
const { app, Menu, nativeImage, Tray } = require('electron');

const getIconPath = () => {
  const iconName = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png';
  return path.join(__dirname, '..', '..', 'assets', 'tray', iconName);
};

const createTray = ({ getWindow, onToggle, onShowSettings, onQuit, logger }) => {
  let tray = null;

  const dispatch = (command, payload = {}) => {
    try {
      const window = getWindow?.();
      window?.webContents?.send('tray:command', { command, payload, timestamp: Date.now() });
    } catch (error) {
      logger?.warn?.('Failed to dispatch tray command to renderer', {
        command,
        error: error?.message,
      });
    }
  };

  const clickToggle = () => {
    try {
      onToggle?.();
      logger?.info?.('Tray toggle invoked');
      dispatch('toggle');
    } catch (error) {
      logger?.error?.('Tray toggle failed', { message: error?.message });
    }
  };

  const clickSettings = () => {
    try {
      onShowSettings?.();
      logger?.info?.('Tray settings invoked');
      dispatch('settings');
    } catch (error) {
      logger?.error?.('Tray settings failed', { message: error?.message });
    }
  };

  const clickAccessibility = () => {
    logger?.info?.('Tray accessibility check invoked');
    dispatch('accessibility-check');
  };

  const clickQuit = () => {
    logger?.info?.('Tray quit invoked');
    dispatch('quit');
    onQuit?.();
  };

  const buildMenu = () => {
    const template = [];

    template.push({
      label: '위젯 열기/닫기',
      click: clickToggle,
    });

    template.push({
      label: '설정...',
      click: clickSettings,
      enabled: typeof onShowSettings === 'function',
    });

    if (process.platform === 'darwin') {
      template.push({ type: 'separator' });
      template.push({
        label: '접근성 권한 확인',
        click: clickAccessibility,
      });
    }

    template.push({ type: 'separator' });
    template.push({
      label: '종료',
      click: clickQuit,
      role: process.platform === 'darwin' ? 'quit' : undefined,
    });

    return Menu.buildFromTemplate(template);
  };

  const create = () => {
    if (tray) {
      return tray;
    }
    const iconPath = getIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);
    tray.setToolTip('JARVIS');
    tray.setContextMenu(buildMenu());

    tray.on('click', clickToggle);

    return tray;
  };

  const dispose = () => {
    if (!tray) return;
    tray.destroy();
    tray = null;
  };

  const updateMenu = () => {
    if (!tray) return;
    tray.setContextMenu(buildMenu());
  };

  return {
    create,
    dispose,
    updateMenu,
  };
};

module.exports = {
  createTray,
};
