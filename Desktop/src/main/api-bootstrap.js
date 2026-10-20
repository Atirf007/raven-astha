'use strict';

/* ============================================================
   ASTHA RAVEN DESKTOP — Bootstrap do Back-end Interno (src/main/api-bootstrap.js)
   Inicializa o servidor próprio de src/main/server.js (sem depender da pasta api/
   do Web App) e conecta ao mesmo banco MySQL para unificar os dois aplicativos.
   ============================================================ */

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const dadosStore = require('./dados-store');

function parseRequestedProfile(argv, env) {
  for (const arg of argv) {
    if (arg === '--profile=local') return { mode: 'local', cotil: false };
    if (arg === '--profile=principal') return { mode: 'principal', cotil: env.ASTHA_ELECTRON_COTIL === 'true' };
    if (arg === '--profile=cotil') return { mode: 'principal', cotil: true };
  }
  if (env.ASTHA_ELECTRON_COTIL === 'true') {
    return { mode: 'principal', cotil: true };
  }
  if (env.ASTHA_WEB_PROFILE === 'principal') {
    return { mode: 'principal', cotil: false };
  }
  return { mode: 'local', cotil: false };
}

function isPortFree(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.listen(Number(port), host, () => {
      tester.close(() => resolve(true));
    });
  });
}

async function selectAvailableDesktopPort(preferredPort = '3001') {
  const candidates = [String(preferredPort), '3001', '3000'];
  for (const candidate of candidates) {
    if (await isPortFree(candidate)) {
      return candidate;
    }
  }
  return String(preferredPort);
}

async function checkExistingServer(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!response.ok) return null;
    const body = await response.json();
    if (body && (body.application === 'astha-raven-desktop' || body.application === 'astha-raven-web') && body.status === 'operational') {
      return body;
    }
  } catch (_) {}
  return null;
}

async function bootstrap() {
  let phase = 'profile';
  let selectedProfileName = 'local';
  try {
    process.chdir(__dirname);

    const requested = parseRequestedProfile(process.argv.slice(2), process.env);
    selectedProfileName = requested.cotil ? 'cotil' : requested.mode;

    if (requested.mode === 'local') {
      const profile = await require('./security/web-profile').select({ requested: 'local' });
      Object.assign(process.env, profile.env);
      process.env.ASTHA_ACTIVE_WEB_PROFILE = profile.name;
      console.log('ASTHA Electron [Cozinha]: perfil local selecionado (127.0.0.1 / astha_raven_lab).');
    } else {
      const dotenvPath = path.join(__dirname, '.env');
      if (fs.existsSync(dotenvPath)) {
        require('dotenv').config({ path: dotenvPath });
      }
      process.env.ASTHA_ACTIVE_WEB_PROFILE = 'principal';

      if (requested.cotil && process.env.DB_SSL_REQUIRED !== 'true') {
        const tlsPath = require.resolve('./security/database-tls');
        require.cache[tlsPath] = {
          id: tlsPath,
          filename: tlsPath,
          loaded: true,
          exports: function cotilDesktopTLS() {
            return {};
          }
        };
        console.log('ASTHA Electron [Cozinha]: perfil COTIL selecionado (' + (process.env.DB_NAME || 'cl205131') + ').');
      } else {
        console.log('ASTHA Electron [Cozinha]: perfil principal selecionado.');
      }
    }

    const preferredPort = process.env.ASTHA_LOCAL_PORT || '3001';
    const chosenPort = await selectAvailableDesktopPort(preferredPort);
    process.env.PORT = chosenPort;

    if (process.send) {
      process.send({ type: 'astha-api-port', port: String(chosenPort) });
    }

    dadosStore.registrarEventoLocal(
      `Servidor Desktop inicializado no perfil ${selectedProfileName} (porta ${chosenPort})`,
      'main-cozinha'
    );

    phase = 'server';
    await require('./server').startServer();
  } catch (error) {
    const message = require('./security/web-startup').failureMessage(error, phase, selectedProfileName);
    console.error('[ASTHA_ELECTRON_BOOTSTRAP]', message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  bootstrap();
}

module.exports = {
  bootstrap,
  parseRequestedProfile,
  checkExistingServer
};
