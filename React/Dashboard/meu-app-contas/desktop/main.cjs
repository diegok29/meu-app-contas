const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_BACKUP_SIZE = 20 * 1024 * 1024;

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 680,
    backgroundColor: '#07131f',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  void window.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

ipcMain.handle('backup:save', async (event, content) => {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_BACKUP_SIZE) {
    throw new Error('Backup inválido ou muito grande.');
  }

  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Salvar backup',
    defaultPath: path.join(app.getPath('documents'), 'meu-app-contas-backup.json'),
    filters: [{ name: 'Backup Meu App Contas', extensions: ['json'] }],
  });

  if (canceled || !filePath) return false;
  await fs.writeFile(filePath, content, 'utf8');
  return true;
});

ipcMain.handle('backup:open', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Restaurar backup',
    properties: ['openFile'],
    filters: [{ name: 'Backup Meu App Contas', extensions: ['json'] }],
  });

  if (canceled || !filePaths[0]) return null;

  const file = await fs.open(filePaths[0], 'r');
  try {
    const { size } = await file.stat();
    if (size > MAX_BACKUP_SIZE) throw new Error('O arquivo de backup excede o limite de 20 MB.');
    return await file.readFile({ encoding: 'utf8' });
  } finally {
    await file.close();
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
