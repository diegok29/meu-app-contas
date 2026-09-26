const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopFiles', {
  salvarBackup: (conteudo) => ipcRenderer.invoke('backup:save', conteudo),
  abrirBackup: () => ipcRenderer.invoke('backup:open'),
});
