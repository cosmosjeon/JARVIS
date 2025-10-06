const path = require('path');
const { BrowserWindow, shell } = require('electron');
const { getRendererUrl } = require('./bootstrap/renderer-url');

let libraryWindow = null;

const createLibraryWindow = ({ isDev = false, logger }) => {
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    libraryWindow.focus();
    return libraryWindow;
  }

  libraryWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'JARVIS Library',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      devTools: isDev,
      spellcheck: false,
    },
  });

  const libraryUrl = getRendererUrl('library');
  logger?.info('Loading library URL', { libraryUrl });
  libraryWindow.loadURL(libraryUrl);

  libraryWindow.on('ready-to-show', () => {
    libraryWindow?.show();
  });

  libraryWindow.on('closed', () => {
    libraryWindow = null;
  });

  libraryWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  libraryWindow.webContents.on('will-navigate', (event, url) => {
    if (!libraryWindow) return;
    if (url !== libraryWindow.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  return libraryWindow;
};

const getLibraryWindow = () => libraryWindow;

module.exports = {
  createLibraryWindow,
  getLibraryWindow,
};
