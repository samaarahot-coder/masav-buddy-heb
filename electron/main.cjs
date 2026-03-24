const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;

// ── Auto-Updater ────────────────────────────────────────
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  dialog
    .showMessageBox(mainWindow, {
      type: 'info',
      title: 'עדכון זמין',
      message: `גרסה חדשה ${info.version} זמינה!\nהאם להוריד ולהתקין?`,
      buttons: ['עדכן עכשיו', 'אחר כך'],
      defaultId: 0,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
});

autoUpdater.on('update-downloaded', () => {
  dialog
    .showMessageBox(mainWindow, {
      type: 'info',
      title: 'העדכון מוכן',
      message: 'העדכון הורד בהצלחה. האפליקציה תופעל מחדש כדי להתקין.',
      buttons: ['הפעל מחדש'],
    })
    .then(() => {
      autoUpdater.quitAndInstall();
    });
});

autoUpdater.on('error', (err) => {
  console.log('Auto-update error:', err);
});

// ── Window ──────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'טרומבון - ניהול גביות מס״ב',
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#f8fafc',
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    autoUpdater.checkForUpdates().catch(() => {});
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Menu ────────────────────────────────────────────────
function createMenu() {
  const template = [
    {
      label: 'טרומבון',
      submenu: [
        { label: 'אודות טרומבון', role: 'about' },
        { label: 'בדוק עדכונים', click: () => autoUpdater.checkForUpdates() },
        { type: 'separator' },
        { label: 'יציאה', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'עריכה',
      submenu: [
        { label: 'בטל', role: 'undo' },
        { label: 'חזור', role: 'redo' },
        { type: 'separator' },
        { label: 'גזור', role: 'cut' },
        { label: 'העתק', role: 'copy' },
        { label: 'הדבק', role: 'paste' },
        { label: 'בחר הכל', role: 'selectAll' },
      ],
    },
    {
      label: 'תצוגה',
      submenu: [
        { label: 'הגדל', role: 'zoomIn' },
        { label: 'הקטן', role: 'zoomOut' },
        { label: 'גודל רגיל', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'מסך מלא', role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
