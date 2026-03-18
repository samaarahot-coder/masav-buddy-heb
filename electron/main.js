const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'טרומבון - ניהול גביות מס״ב',
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#f8fafc',
  });

  // Graceful show
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the Vite dev server in development, or the built files in production
  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Build a simple Hebrew menu
function createMenu() {
  const template = [
    {
      label: 'טרומבון',
      submenu: [
        { label: 'אודות טרומבון', role: 'about' },
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
