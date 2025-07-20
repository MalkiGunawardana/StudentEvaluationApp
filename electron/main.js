const { app, BrowserWindow } = require('electron');
const path = require('path');

async function createWindow() {
  const { default: isDev } = await import('electron-is-dev');
  // Create the browser window
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#1B263B', // A dark background to match your splash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,  // optional but recommended
      webSecurity: true, // Recommended for security
    },
    icon: path.join(__dirname, '../assets/images/logobgr.png'),
  });

  if (isDev) {
    // In development, load from the Expo dev server.
    win.loadURL('http://localhost:8081');
    win.webContents.openDevTools();
  } else {
    // In production, load the static web build.
    win.loadFile(path.join(__dirname, '../dist/index.html'));

    // Open DevTools in production for debugging
    win.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished initialization.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
