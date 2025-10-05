module.exports = (ipcRenderer) => ({
  isElectron: true,
  checkAccessibilityPermission: () => ipcRenderer.invoke('system:accessibility:check'),
  requestAccessibilityPermission: () => ipcRenderer.invoke('system:accessibility:request'),
});
