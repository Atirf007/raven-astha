'use strict';

/* ============================================================
   src/main/index.js — A COZINHA (Back-end Node.js / Electron Main)
   Responsável por:
   1. Gerenciar a janela nativa do sistema operacional (BrowserWindow)
   2. Processar os pedidos vindos do Garçom (src/main/preload.js) via IPC
   3. Ler e persistir o banco local (dados.json)
   4. Iniciar o servidor interno próprio do Electron conectado ao mesmo
      banco de dados MySQL do Web App (unificando os dois programas)
   ============================================================ */

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');
const dadosStore = require('./dados-store');

const electronRoot = path.resolve(__dirname, '..', '..');
const rendererRoot = path.resolve(__dirname, '..', 'renderer');

function desktopServer(rawUrl = process.env.ASTHA_SERVER_URL) {
  if (!rawUrl) {
    const port = process.env.ASTHA_LOCAL_PORT && /^\d+$/.test(process.env.ASTHA_LOCAL_PORT)
      ? process.env.ASTHA_LOCAL_PORT
      : '3001';
    return { url: `http://localhost:${port}`, local: true };
  }
  const parsed = new URL(rawUrl);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    (parsed.pathname && parsed.pathname !== '/') ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('ASTHA_SERVER_URL deve ser uma origem HTTPS válida');
  }
  return { url: parsed.origin, local: false };
}

function resolveWindowIcon() {
  const candidates = [
    path.join(rendererRoot, 'images', 'app_icon.png'),
    path.join(rendererRoot, 'assets', 'astha_logo.png'),
    path.join(rendererRoot, 'images', 'Logotipo (Alpha).png')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function createWindowOptions() {
  const icon = resolveWindowIcon();
  return {
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'ASTHA RAVEN WMS — Desktop',
    backgroundColor: '#0a0e17',
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    }
  };
}

function applyWindowSecurity(win, deployment) {
  win.setMenuBarVisibility(false);

  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
  win.webContents.session.setPermissionCheckHandler(() => false);

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) {
        Promise.resolve(shell.openExternal(parsed.href)).catch(() => {});
      }
    } catch (_) {}
    return { action: 'deny' };
  });

  const guardNavigation = (event, targetUrl) => {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.origin === deployment.url && !parsed.username && !parsed.password) {
        return;
      }
    } catch (_) {}
    event.preventDefault();
  };

  win.webContents.on('will-navigate', guardNavigation);
  win.webContents.on('will-redirect', guardNavigation);
}

let mainWindow = null;
let apiProcess = null;
let apiReady = false;
let activeProfile = process.env.ASTHA_ELECTRON_COTIL === 'true'
  ? 'cotil'
  : (process.env.ASTHA_WEB_PROFILE || 'local');

let deployment;
try {
  deployment = desktopServer(process.env.ASTHA_SERVER_URL);
} catch {
  deployment = null;
}

function createWindow() {
  if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
    if (typeof mainWindow.isMinimized === 'function' && mainWindow.isMinimized()) mainWindow.restore();
    if (typeof mainWindow.focus === 'function') mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow(createWindowOptions());
  applyWindowSecurity(mainWindow, deployment);

  mainWindow.loadURL(deployment.url);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function stopApi() {
  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill();
    apiProcess = null;
  }
}

function resolveBootstrapArgs() {
  const args = [];
  const rawArgs = Array.isArray(process.argv) ? process.argv.slice(1) : [];
  for (const arg of rawArgs) {
    if (['--profile=local', '--profile=principal', '--profile=cotil'].includes(arg)) {
      args.push(arg);
    }
  }
  return args;
}

// ── Registro dos Pedidos IPC do Garçom (preload.js) na Cozinha (index.js) ──
function registerIpcHandlers() {
  if (!ipcMain || typeof ipcMain.handle !== 'function') return;

  ipcMain.handle('dados:ler', async () => {
    if (deployment && deployment.local && apiReady) {
      try {
        const res = await fetch(`${deployment.url}/api/desktop/dados`, {
          signal: AbortSignal.timeout(2500)
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    return dadosStore.lerDados();
  });

  ipcMain.handle('dados:salvar', async (_event, novosDados) => {
    const seguro = novosDados && typeof novosDados === 'object' ? novosDados : {};
    return dadosStore.salvarDados(seguro);
  });

  ipcMain.handle('dados:sincronizar', async (_event, descricaoEvento) => {
    if (deployment && deployment.local && apiReady) {
      try {
        const res = await fetch(`${deployment.url}/api/desktop/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: descricaoEvento || 'Sincronização manual via Desktop' }),
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    return dadosStore.registrarEventoLocal(descricaoEvento || 'Sincronização local em dados.json');
  });

  ipcMain.handle('astha:runtime-info', () => ({
    isDesktop: true,
    architecture: 'src/main + src/renderer + dados.json',
    serverUrl: deployment ? deployment.url : null,
    local: deployment ? deployment.local : false,
    profile: activeProfile,
    dadosPath: path.relative(electronRoot, dadosStore.DADOS_PATH)
  }));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  registerIpcHandlers();

  app.on('ready', () => {
    if (!deployment) {
      dialog.showErrorBox(
        'Configuração inválida',
        'ASTHA_SERVER_URL deve conter somente a origem HTTPS do servidor central.'
      );
      app.quit();
      return;
    }

    if (!deployment.local) {
      createWindow();
      return;
    }

    const bootstrapScript = path.join(__dirname, 'api-bootstrap.js');
    apiProcess = fork(bootstrapScript, resolveBootstrapArgs(), {
      cwd: __dirname,
      env: { ...process.env, ASTHA_LOCAL_PORT: process.env.ASTHA_LOCAL_PORT || '3001' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });

    apiProcess.on('message', msg => {
      if (msg && msg.type === 'astha-api-port' && deployment.local && /^\d+$/.test(String(msg.port))) {
        deployment.url = 'http://localhost:' + String(msg.port);
        return;
      }
      if (msg && msg.type === 'astha-api-ready' && !apiReady) {
        apiReady = true;
        if (msg.port && deployment.local && /^\d+$/.test(String(msg.port))) {
          deployment.url = 'http://localhost:' + String(msg.port);
        }
        if (msg.profile) activeProfile = msg.profile;
        createWindow();
      }
    });

    apiProcess.on('exit', code => {
      if (!apiReady && code !== 0) {
        dialog.showErrorBox(
          'ASTHA RAVEN Desktop',
          'Não foi possível iniciar o servidor interno do Electron. Verifique o serviço MySQL ou o perfil selecionado.'
        );
        app.quit();
      }
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && (apiReady || (deployment && !deployment.local))) {
      createWindow();
    }
  });

  app.on('before-quit', stopApi);
  app.on('window-all-closed', () => {
    stopApi();
    if (process.platform !== 'darwin') app.quit();
  });
}

module.exports = {
  desktopServer,
  createWindowOptions,
  applyWindowSecurity
};
