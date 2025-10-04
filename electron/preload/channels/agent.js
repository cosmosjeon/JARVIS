module.exports = (ipcRenderer) => ({
  askRoot: (payload) => ipcRenderer.invoke('agent:askRoot', payload),
  askChild: (payload) => ipcRenderer.invoke('agent:askChild', payload),
  extractKeyword: (payload) => ipcRenderer.invoke('agent:extractKeyword', payload),
});
