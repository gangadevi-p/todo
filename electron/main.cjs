const { app, BrowserWindow, ipcMain, Menu, nativeTheme, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const TITLEBAR_HEIGHT = 44;

app.setName('Nudge');
if (process.platform === 'win32') app.setAppUserModelId('app.nudge.tasks');

const userFile = (name) => path.join(app.getPath('userData'), name);
// Two separate spaces: "owner" is the personal data (file names unchanged so
// existing installs keep everything), "demo" is a sample copy for showing off.
const SPACES = {
  owner: { data: 'nudge-data.json', backup: 'nudge-data.backup.json' },
  demo: { data: 'nudge-demo-data.json', backup: 'nudge-demo-data.backup.json' },
};
const spaceOf = (space) => SPACES[space] || SPACES.owner;
const DATA = (space) => userFile(spaceOf(space).data);
const BACKUP = (space) => userFile(spaceOf(space).backup);
const AUTH = () => userFile('nudge-auth.json');
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

function loadData(space) {
  if (!fs.existsSync(DATA(space))) return null;
  const data = readJson(DATA(space));
  if (data && Array.isArray(data.tasks)) {
    // One backup per launch, so a bad session can always be rolled back.
    try { fs.copyFileSync(DATA(space), BACKUP(space)); } catch {}
    return data;
  }
  // The data file is unreadable: keep it aside instead of overwriting it.
  try { fs.renameSync(DATA(space), userFile(`${spaceOf(space).data}.corrupt-${Date.now()}.json`)); } catch {}
  const backup = readJson(BACKUP(space));
  return backup && Array.isArray(backup.tasks) ? backup : null;
}

function saveData(space, data) {
  try {
    writeJsonAtomic(DATA(space), data);
    return true;
  } catch (err) {
    console.error('Failed to save data', err);
    return false;
  }
}

ipcMain.handle('store:load', (_e, space) => ({ data: loadData(space), platform: process.platform }));
ipcMain.on('store:save', (_e, space, data) => saveData(space, data));
ipcMain.on('store:save-sync', (e, space, data) => { e.returnValue = saveData(space, data); });

// Sign-in credentials (salted hash only). Set once; delete nudge-auth.json to reset.
ipcMain.handle('auth:get', () => readJson(AUTH()) || null);
ipcMain.handle('auth:set', (_e, cred) => {
  if (fs.existsSync(AUTH())) return false;
  if (!cred || typeof cred.username !== 'string' || typeof cred.salt !== 'string' || typeof cred.hash !== 'string') return false;
  try { writeJsonAtomic(AUTH(), { username: cred.username, salt: cred.salt, hash: cred.hash, iterations: cred.iterations }); return true; } catch { return false; }
});

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
