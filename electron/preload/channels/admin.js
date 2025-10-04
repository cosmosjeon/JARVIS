module.exports = (ipcRenderer) => ({
  openAdminPanel: () => ipcRenderer.invoke('admin-panel:ensure'),
  closeAdminPanel: () => ipcRenderer.invoke('admin-panel:close'),
});
