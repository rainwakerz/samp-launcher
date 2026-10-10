const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    frame: false,
    resizable: true,
    maximizable: true,
    backgroundColor: '#0a0a0a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('src/index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // ---------- Window control ----------
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow.close());

  mainWindow.on('maximize', () =>
    mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () =>
    mainWindow.webContents.send('window:maximized', false));

  // ---------- Диалог выбора папки ----------
  ipcMain.handle('dialog:pickFolder', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите папку с GTA: San Andreas',
      properties: ['openDirectory'],
      buttonLabel: 'Выбрать'
    });
    if (res.canceled || !res.filePaths.length) return null;
    return res.filePaths[0];
  });

  // ---------- Запуск SAMP (правильный, с обходом samp.cfg) ----------
  ipcMain.handle('launch:samp', async (_e, { nickname, serverIp, sampPath }) => {
    return new Promise((resolve) => {
      try {
        // --- Парсим IP:порт ---
        const raw = String(serverIp).trim();
        const lastColon = raw.lastIndexOf(':');
        let host, port;
        if (lastColon > 0) {
          host = raw.slice(0, lastColon);
          port = raw.slice(lastColon + 1);
        } else {
          host = raw;
          port = '7777';
        }

        if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) {
          return resolve({ success: false, error: 'Неверный порт: ' + port });
        }

        const exe = path.join(sampPath, 'samp.exe');
        if (!fs.existsSync(exe)) {
          return resolve({ success: false, error: 'samp.exe не найден: ' + exe });
        }

        // ⚠️ КЛЮЧЕВОЙ МОМЕНТ: удаляем samp.cfg, если он есть.
        // Иначе samp.exe проигнорирует -h/-p и возьмёт host/port оттуда.
        const cfgPath = path.join(sampPath, 'samp.cfg');
        try {
          if (fs.existsSync(cfgPath)) {
            fs.unlinkSync(cfgPath);
            console.log('[launch] удалён старый samp.cfg');
          }
        } catch (e) {
          console.warn('[launch] не удалось удалить samp.cfg:', e.message);
        }

        // --- Аргументы ---
        // Без -o! Порядок: -c -n <nick> -h <host> -p <port>
        const args = [
          '-c',
          '-n', nickname,
          '-h', host,
          '-p', port
        ];

        console.log('[launch] exe :', exe);
        console.log('[launch] args:', args);

        const proc = spawn(exe, args, {
          cwd: sampPath,
          detached: true,
          stdio: 'ignore'
        });

        proc.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });

        proc.unref();
        resolve({ success: true });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  });

  // ---------- Настройки ----------
  const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

  ipcMain.handle('settings:load', () => {
    try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')); }
    catch { return {}; }
  });

  ipcMain.handle('settings:save', (_e, data) => {
    fs.writeFileSync(settingsPath(), JSON.stringify(data, null, 2));
    return true;
  });

  // ---------- Серверы ----------
  const serversPath = () => path.join(app.getPath('userData'), 'servers.json');

  ipcMain.handle('servers:load', () => {
    try {
      const data = JSON.parse(fs.readFileSync(serversPath(), 'utf-8'));
      if (Array.isArray(data) && data.length) return data;
    } catch {}
    return [
      { name: 'Arizona RP', ip: '127.0.0.1:7777',    online: 850,  slots: 1000 },
      { name: 'Advance RP', ip: '51.38.100.10:7777', online: 720,  slots: 1000 },
      { name: 'Samp-Rp',    ip: '51.83.130.20:7777', online: 1000, slots: 1000 }
    ];
  });

  ipcMain.handle('servers:save', (_e, list) => {
    fs.writeFileSync(serversPath(), JSON.stringify(list, null, 2));
    return true;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});