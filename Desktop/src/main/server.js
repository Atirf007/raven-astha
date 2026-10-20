'use strict';

/* ============================================================
   ASTHA RAVEN DESKTOP — Servidor Interno Independente (src/main/server.js)
   Roda dentro da Cozinha (src/main/), servindo a interface própria
   de src/renderer/ e conectando ao mesmo banco MySQL do Web App
   além de sincronizar com electron/dados.json.
   ============================================================ */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('node:path');

const { testConnection, pool } = require('./database/connection');
const dadosStore = require('./dados-store');

const authRoutes = require('./routes/auth');
const oauthRoutes = require('./routes/oauth');
const materialsRoutes = require('./routes/materials');
const contactRoutes = require('./routes/contact');
const movementsRoutes = require('./routes/movements');
const warehouseRoutes = require('./routes/warehouse');
const componentsRoutes = require('./routes/components');
const materialFilesRoutes = require('./routes/material-files');
const organizationsRoutes = require('./routes/organizations');
const eamRoutes = require('./routes/eam');
const procurementRoutes = require('./routes/procurement');
const orgWorkspaceRoutes = require('./routes/org-workspace');
const groupAccess = require('./middleware/groupAccess');
const ensureOrgWorkspace = require('./database/ensure_org_workspace');

const app = express();
const WEB_BUILD = require('./security/web-build').fingerprint();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';

require('./security/tokens').secret();
app.disable('x-powered-by');
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'self'", 'https:', 'data:', 'blob:'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
      'script-src': ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://accounts.google.com/gsi/client'],
      'frame-src': ["'self'", 'blob:', 'https://accounts.google.com/gsi/'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(['/app/login.html', '/app/register.html'], (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/app/viewer-3d.html', (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "default-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; frame-ancestors *;");
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

const configuredOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const localDevelopmentOrigins = process.env.NODE_ENV === 'production' ? [] : [
  `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`,
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:3001', 'http://127.0.0.1:3001'
];
const allowedOrigins = new Set([...configuredOrigins, ...localDevelopmentOrigins]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
      return callback(null, true);
    }
    const err = new Error('Origin denied');
    err.status = 403;
    callback(err);
  },
  credentials: false
}));

app.use('/api', rateLimit({
  windowMs: 60000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de requisições excedido. Aguarde um minuto.' }
}));
app.use(express.json({ limit: '15mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '1mb', parameterLimit: 100 }));

app.use('/api', require('./middleware/attackGuard'));
app.use('/api/', require('./middleware/applicationRateLimit').applicationRateLimit());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas de login a partir desta rede. Aguarde 15 minutos.' }
});
const userRateLimiter = require('./middleware/rateLimitByUser');

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/login', userRateLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/oauth', authLimiter);
app.use('/api/auth/check-invite', authLimiter);

// ── Front-end Próprio do Electron (src/renderer/) ──
const rendererRoot = path.join(__dirname, '..', 'renderer');
const workspaceMode = require('./middleware/workspaceMode');
const protectedPages = new Set([
  'home.html', 'sistema.html', 'settings.html', 'analytics.html',
  'viewer-3d.html', 'personal.html', 'onboarding.html', 'account.html'
]);

app.use('/app', (req, res, next) => {
  let page;
  try {
    const decoded = decodeURIComponent(req.path).replace(/\\/g, '/');
    if (decoded.split('/').some(segment => segment !== '.' && segment !== '..' && /[. ]$/.test(segment))) {
      return res.sendStatus(404);
    }
    page = path.posix.normalize('/' + decoded).replace(/^\/|\/$/g, '').toLowerCase();
  } catch (_) {
    return res.sendStatus(404);
  }
  if (!protectedPages.has(page)) return next();
  req.workspacePage = '/app/' + page;
  workspaceMode.pageAccess(req, res, next);
});

app.get('/app/js/analytics-statistics.js', (req, res) =>
  res.sendFile(path.join(__dirname, 'services', 'analytics', 'statistics.js'))
);
app.get('/', (req, res) => res.sendFile(path.join(rendererRoot, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(rendererRoot, 'index.html')));
app.get('/renderer.js', (req, res) => res.sendFile(path.join(rendererRoot, 'renderer.js')));
app.get('/app/renderer.js', (req, res) => res.sendFile(path.join(rendererRoot, 'renderer.js')));

const publicTypes = new Set([
  '.html', '.css', '.js', '.wasm', '.png', '.jpg',
  '.jpeg', '.svg', '.webp', '.ico', '.woff', '.woff2'
]);
const publicDirectories = {
  app: '',
  assets: 'assets',
  images: 'images'
};

for (const [directory, relative] of Object.entries(publicDirectories)) {
  app.use('/' + directory, (req, res, next) => {
    if (req.path.endsWith('/') || publicTypes.has(path.extname(req.path).toLowerCase())) {
      return next();
    }
    return res.sendStatus(404);
  }, express.static(path.join(rendererRoot, relative), { dotfiles: 'deny', index: 'index.html' }));
}

// ── Rotas Exclusivas de Sincronização Desktop (dados.json <-> MySQL) ──
app.get('/api/desktop/dados', async (req, res) => {
  const dados = await dadosStore.sincronizarComMySQL(pool);
  res.status(200).json(dados);
});

app.post('/api/desktop/sync', async (req, res) => {
  if (req.body && typeof req.body.titulo === 'string') {
    dadosStore.registrarEventoLocal(req.body.titulo, 'renderer-ui');
  }
  const dados = await dadosStore.sincronizarComMySQL(pool);
  res.status(200).json(dados);
});

// ── Rotas de Domínio (compartilhando o mesmo banco MySQL do Web App) ──
app.use(['/api/eam', '/api/procurement', '/api/components', '/api/materials', '/api/movements', '/api/warehouse', '/api/analytics', '/api/assistant', '/api/auth/users'], ...workspaceMode.corporateOnly);
app.use('/api/org', ...workspaceMode.organizationGate);
app.use('/api/workspace', require('./routes/workspace'));
app.use('/api/personal', require('./routes/personal'));
app.use('/api/account', require('./routes/account'));
app.use('/api/auth', authRoutes);
app.use('/api/auth/oauth', oauthRoutes);
app.use('/api/materials', groupAccess('wms'), materialsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/movements', groupAccess('wms'), movementsRoutes);
app.use('/api/warehouse', groupAccess('wms'), warehouseRoutes);
app.use('/api/components', groupAccess('components'), componentsRoutes);
app.use('/api/materials', groupAccess('wms'), materialFilesRoutes);
app.use('/api/org', organizationsRoutes);
app.use('/api/org', orgWorkspaceRoutes);
app.use('/api/iot', require('./routes/iot-devices').ingestion);
app.use('/api/eam', groupAccess('eam'), eamRoutes);
app.use('/api/procurement', groupAccess('eam'), procurementRoutes);
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/assistant', require('./routes/assistant'));

app.get('/api/azure/health', (req, res) => {
  res.status(200).json({
    status: 'operational',
    azure: { connected: false, message: 'Provisionamento de credenciais pendente' },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/plans', (req, res) => {
  res.status(200).json([
    { id: 'starter', name: 'Starter', price: 0, features: ['100 materiais', '1 usuário', 'Dashboard básico'] },
    { id: 'pro', name: 'Pro', price: 19.90, features: ['Ilimitado', '5 usuários', 'Azure integrado', 'Mapa 2D'] },
    { id: 'personalizado', name: 'Personalizado', price: null, features: ['Tudo do Pro', 'Ilimitado', 'SLA personalizado', 'Suporte 24/7'] }
  ]);
});

app.get('/api/health', async (req, res) => {
  const dbOk = await testConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'operational' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    application: 'astha-raven-desktop',
    webCompatible: true,
    revision: 'desktop-2026-10-19-standalone',
    build: WEB_BUILD,
    ...(process.env.ASTHA_ACTIVE_WEB_PROFILE === 'local' ? { environment: 'local-test' } : {}),
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, _next) => {
  console.error('[DESKTOP_HTTP_ERROR]', Number.isInteger(err.status) ? err.status : 500);
  res.status([400, 403, 413].includes(err.status) ? err.status : 500).json({
    error: 'Falha catastrófica interna no servidor Desktop'
  });
});

async function startServer() {
  const net = require('node:net');
  const reservation = net.createServer();
  try {
    await new Promise((resolve, reject) => {
      reservation.once('error', reject);
      reservation.listen(PORT, HOST, resolve);
    });
  } catch (error) {
    console.error(error.code === 'EADDRINUSE' ? 'A porta ' + PORT + ' já está em uso.' : 'Não foi possível reservar a porta HTTP do Desktop.');
    await pool.end();
    process.exitCode = 1;
    return;
  }

  const dbOk = await testConnection();
  if (dbOk) {
    try {
      await ensureOrgWorkspace();
      await dadosStore.sincronizarComMySQL(pool);
    } catch (error) {
      console.error('[DESKTOP_ORG_WORKSPACE_SCHEMA]', error.code || 'Falha de inicialização');
    }
  } else {
    dadosStore.salvarDados({
      conexaoBanco: {
        status: 'modo_offline_json',
        ultimaSincronizacao: new Date().toISOString()
      }
    });
  }

  await new Promise(resolve => reservation.close(resolve));
  console.log('ASTHA RAVEN DESKTOP - Servidor Interno Independente v1.0');
  console.log(dbOk ? 'Banco MySQL compartilhado conectado e sincronizado com dados.json.' : 'Banco MySQL indisponível (usando dados.json local).');

  const server = app.listen(PORT, HOST, () => {
    console.log('Servidor Desktop disponível na porta ' + PORT);
    if (process.send) {
      process.send({
        type: 'astha-api-ready',
        port: String(PORT),
        profile: process.env.ASTHA_ACTIVE_WEB_PROFILE || 'local'
      });
    }
  });

  const stopAnalytics = require('./routes/analytics').startProcessor();
  server.on('error', async error => {
    console.error(error.code === 'EADDRINUSE' ? 'A porta HTTP foi ocupada por outra instância.' : 'Não foi possível iniciar o servidor Desktop.');
    await pool.end();
    process.exitCode = 1;
  });

  let closing = false;
  const exitProcess = () => {
    if (closing) return;
    closing = true;
    stopAnalytics();
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10000).unref();
  };

  process.on('SIGINT', exitProcess);
  process.on('SIGTERM', exitProcess);
  process.on('disconnect', exitProcess);
  return server;
}

if (require.main === module) startServer();
module.exports = { app, startServer };
