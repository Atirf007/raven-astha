const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    // icon: path.join(__dirname, 'app', 'assets', 'favicon.ico'),
    autoHideMenuBar: true
  });

  mainWindow.setMenuBarVisibility(false);

  // Wait a moment for the Express server to bind to port 3000
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000/app/login.html').catch(err => {
      console.error('Failed to load local server, retrying in 2 seconds...');
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000/app/login.html');
      }, 2000);
    });
  }, 1000);
}

app.whenReady().then(() => {
  // Start the backend API + Web Server locally
  try {
    require('./api/server.js');
    console.log('Internal ASTAH RAVEN server started successfully.');
  } catch(e) {
    console.error('Failed to start internal server:', e);
  }

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
