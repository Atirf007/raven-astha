const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const { desktopServer } = require('./desktop-server');

let deployment;
try { deployment = desktopServer(process.env.ASTHA_SERVER_URL); } catch { deployment = null; }

let mainWindow;
let serverProcess;
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on('second-instance', () => { if (mainWindow) { if(mainWindow.isMinimized()) mainWindow.restore();mainWindow.focus(); } });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "ASTHA RAVEN",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    try { const target = new URL(url); if (target.protocol === 'https:' && !target.username && !target.password) shell.openExternal(target.href); } catch {}
    return { action: 'deny' };
  });
  const guardNavigation = (event, target) => {
    try { const url = new URL(target); if (!url.username && !url.password && url.origin === deployment.url) return; } catch {}
    event.preventDefault();
  };
  mainWindow.webContents.on('will-navigate', guardNavigation);
  mainWindow.webContents.on('will-redirect', guardNavigation);
  mainWindow.loadURL(deployment.url);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  if (!ownsInstance) return;
  if (!deployment) {
    dialog.showErrorBox('Configuração inválida', 'ASTHA_SERVER_URL deve conter somente a origem HTTPS do servidor central.');
    app.quit();
    return;
  }
  if (!deployment.local) { createWindow(); return; }
  // Start the express backend, ensuring cwd is api/ so .env is loaded correctly
  serverProcess = fork(path.join(__dirname, 'api', 'server.js'), [], {
    cwd: path.join(__dirname, 'api'),
    env: { ...process.env, PORT: 3000 },
    stdio: 'inherit'
  });

  let ready = false;
  serverProcess.on('message', message => {
    if (!ready && message?.type === 'astha-api-ready') { ready = true; createWindow(); }
  });
  serverProcess.on('exit', () => {
    serverProcess = null;
    if (!ready) { dialog.showErrorBox('Não foi possível iniciar', 'A API não iniciou. Verifique se a porta 3000 já está em uso e se o banco de dados está disponível.'); app.quit(); }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (serverProcess) serverProcess.kill();
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) serverProcess.kill();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
