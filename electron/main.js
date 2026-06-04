const { app, BrowserWindow, Tray, Menu, shell, nativeImage, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_URL = process.env.ELECTRON_APP_URL || 'https://e-messenger.fly.dev';
const APP_PROTOCOL = 'emessenger';
let mainWindow = null;
let tray = null;

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  const preloadPath = path.join(__dirname, 'preload.js');
  const appUrl = new URL(APP_URL);
  appUrl.searchParams.set('desktop', '1');
  appUrl.searchParams.set('desktopBuild', String(Date.now()));

  mainWindow = new BrowserWindow({
    width: 430,
    height: 720,
    minWidth: 390,
    minHeight: 620,
    title: 'E-Messenger',
    backgroundColor: '#f2f3f5',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    frame: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(appUrl.toString());
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  let icon;
  try {
    icon = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty();
  } catch (_) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('E-Messenger');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'E-Messenger 열기', click: showMainWindow },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuiting = true; app.quit(); } },
  ]));
  tray.on('double-click', showMainWindow);
}

function sendWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('window-state', { maximized: mainWindow.isMaximized() });
}

function showMainWindow() {
  if (!mainWindow) createWindow();
  mainWindow.show();
  mainWindow.focus();
}

function registerAppProtocol() {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    return;
  }

  app.setAsDefaultProtocolClient(APP_PROTOCOL);
}

function handleProtocolUrl(url) {
  if (!url || !url.startsWith(`${APP_PROTOCOL}://`)) return;
  showMainWindow();
}

async function clearStaleWebCache() {
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
      storages: ['appcache', 'serviceworkers', 'cachestorage'],
    });
  } catch (error) {
    console.warn('Failed to clear web cache:', error);
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.setAppUserModelId('com.emessenger.app');
  registerAppProtocol();

  app.on('second-instance', (_event, argv) => {
    const protocolUrl = argv.find(arg => arg.startsWith(`${APP_PROTOCOL}://`));
    handleProtocolUrl(protocolUrl);
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });

  app.whenReady().then(async () => {
    await clearStaleWebCache();
    createWindow();
    createTray();
    const protocolUrl = process.argv.find(arg => arg.startsWith(`${APP_PROTOCOL}://`));
    handleProtocolUrl(protocolUrl);
  });
}

app.on('window-all-closed', () => {});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else showMainWindow();
});
app.on('before-quit', () => { app.isQuiting = true; });

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:is-maximized', () => Boolean(mainWindow?.isMaximized()));
