module.exports = (ipcRenderer) => ({
  isElectron: true,
  process: {
    platform: process.platform,
  },
  checkAccessibilityPermission: () => ipcRenderer.invoke('system:accessibility:check'),
  requestAccessibilityPermission: () => ipcRenderer.invoke('system:accessibility:request'),
});
