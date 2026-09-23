const { app, BrowserWindow, ipcMain, Menu, nativeTheme, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const TITLEBAR_HEIGHT = 44;

app.setName('Nudge');
if (process.platform === 'win32') app.setAppUserModelId('app.nudge.tasks');

const userFile = (name) => path.join(app.getPath('userData'), name);
const DATA = () => userFile('nudge-data.json');
const BACKUP = () => userFile('nudge-data.backup.json');
const WINDOW_STATE = () => userFile('window-state.json');

// ---------- persistence ----------

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function loadData() {
  if (!fs.existsSync(DATA())) return null;
  const data = readJson(DATA());
  if (data && Array.isArray(data.tasks)) {
    // One backup per launch, so a bad session can always be rolled back.
    try { fs.copyFileSync(DATA(), BACKUP()); } catch {}
    return data;
  }
  // The data file is unreadable: keep it aside instead of overwriting it.
  try { fs.renameSync(DATA(), userFile(`nudge-data.corrupt-${Date.now()}.json`)); } catch {}
  const backup = readJson(BACKUP());
  return backup && Array.isArray(backup.tasks) ? backup : null;
}

function saveData(data) {
  try {
    writeJsonAtomic(DATA(), data);
    return true;
  } catch (err) {
    console.error('Failed to save data', err);
    return false;
  }
}

ipcMain.handle('store:load', () => ({ data: loadData(), platform: process.platform }));
ipcMain.on('store:save', (_e, data) => saveData(data));
ipcMain.on('store:save-sync', (e, data) => { e.returnValue = saveData(data); });

// ---------- window ----------

function overlayColors() {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#191919', symbolColor: '#d4d4d4', height: TITLEBAR_HEIGHT }
    : { color: '#ffffff', symbolColor: '#5f5e5b', height: TITLEBAR_HEIGHT };
}

function restoreBounds() {
  const saved = readJson(WINDOW_STATE());
  const fallback = { width: 1280, height: 820 };
  if (!saved || !saved.width) return fallback;
  const visible = screen.getAllDisplays().some(({ workArea: a }) =>
    saved.x >= a.x - 50 && saved.y >= a.y - 50 && saved.x < a.x + a.width - 100 && saved.y < a.y + a.height - 100);
  return visible ? saved : { width: saved.width, height: saved.height };
}

function createWindow() {
  const bounds = restoreBounds();
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 860,
    minHeight: 560,
    show: false,
    title: "Gani's Work",
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#191919' : '#ffffff',
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 16, y: 15 } }
      : { titleBarOverlay: overlayColors() }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  if (bounds.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  const onTheme = () => {
    if (process.platform !== 'darwin') {
      try { win.setTitleBarOverlay(overlayColors()); } catch {}
    }
    win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#191919' : '#ffffff');
  };
  nativeTheme.on('updated', onTheme);

  win.on('close', () => {
    try {
      writeJsonAtomic(WINDOW_STATE(), { ...win.getNormalBounds(), maximized: win.isMaximized() });
    } catch {}
  });
  win.on('closed', () => nativeTheme.removeListener('updated', onTheme));

  // Keep the app a single, self-contained window.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!DEV_URL || !url.startsWith(DEV_URL)) e.preventDefault();
  });

  if (DEV_URL) {
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
    });
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function buildMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  // macOS needs a menu for copy/paste and quit shortcuts.
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ]));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
