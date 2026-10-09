/* ============================================================
   ASTHA RAVEN â��⬝ API Server (server.js)
   Express + MySQL + JWT auth, rate limiting, CORS
   ============================================================ */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// â⬝��â⬝�� AbstraÒ§Ò£o de Dados â⬝��â⬝��
const { testConnection, pool } = require('./database/connection');

// â⬝��â⬝�� MÒ³dulos de Roteamento â⬝��â⬝��
const authRoutes        = require('./routes/auth');
const oauthRoutes       = require('./routes/oauth');
const materialsRoutes   = require('./routes/materials');
const contactRoutes     = require('./routes/contact');
const movementsRoutes   = require('./routes/movements');
const warehouseRoutes   = require('./routes/warehouse');
const componentsRoutes  = require('./routes/components');
const materialFilesRoutes = require('./routes/material-files');
const organizationsRoutes = require('./routes/organizations');
const eamRoutes = require('./routes/eam');
const procurementRoutes = require('./routes/procurement');
const orgWorkspaceRoutes = require('./routes/org-workspace');
const groupAccess = require('./middleware/groupAccess');
const ensureOrgWorkspace = require('./database/ensure_org_workspace');

const app = express();
const WEB_BUILD = require('./security/web-build').fingerprint();
// PriorizaÒ§Ò£o estrita da variÒ¡vel de ambiente com fallback algorÒ­tmico
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
require('./security/tokens').secret();
app.disable('x-powered-by');
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });

// â⬝��â⬝�� Security & Payload Middleware â⬝��â⬝��
app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: {
      'default-src': ["'self'", 'https:', 'data:', 'blob:'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'script-src': ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      'object-src': ["'none'"], 'base-uri': ["'self'"],
      'frame-ancestors': ["'none'"], 'form-action': ["'self'"]
    } },
    crossOriginEmbedderPolicy: false,
}));
// CORS: only allow configured origins (never wildcard in production)
const configuredOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(origin => origin.trim()).filter(Boolean);
const localDevelopmentOrigins = process.env.NODE_ENV === 'production' ? [] : [
  `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`,
  'http://localhost:4173', 'http://127.0.0.1:4173',
  'http://localhost:5500', 'http://127.0.0.1:5500',
  'http://localhost:5501', 'http://127.0.0.1:5501'
];
const allowedOrigins = new Set([...configuredOrigins, ...localDevelopmentOrigins]);
app.use(cors({
  origin: function(origin, callback) {
    // Requests without Origin include CLI clients; browser origins must be explicit.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    const err = new Error('Origin denied'); err.status = 403; callback(err);
  },
  credentials: false
}));
// 10 MiB binary attachments require roughly 13.4 MiB after base64 encoding.
app.use('/api', rateLimit({windowMs:60000,max:600,standardHeaders:true,legacyHeaders:false,message:{error:'Limite de requisições excedido. Aguarde um minuto.'}}));
app.use(express.json({ limit: '15mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '1mb', parameterLimit: 100 }));

// â⬝��â⬝�� Network Rate Limiting â⬝��â⬝��
app.use('/api', require('./middleware/attackGuard'));
// Per-user read/write quotas preserve the independent login protection.
app.use('/api/', require('./middleware/applicationRateLimit').applicationRateLimit());

// Strict auth rate limiter (brute-force protection by IP)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 min
    max: 15,                    // 15 login attempts
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Muitas tentativas de login a partir desta rede. Aguarde 15 minutos.' }
});

// Strict auth rate limiter (brute-force protection by User Email)
const userRateLimiter = require('./middleware/rateLimitByUser');

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/login', userRateLimiter); // Adds the second layer of protection
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/oauth', authLimiter);
app.use('/api/auth/check-invite', authLimiter);

// ���� Static Assets ����
// Only known public asset directories are served; source/config/SQL are not web assets.
const publicRoot = path.join(__dirname, '..');
// One fixed, pure mathematics module is shared by browser previews and the worker.
// No directory in api/ is exposed, and this module has no secrets or I/O.
app.get('/app/js/analytics-statistics.js', (req, res) => res.sendFile(path.join(__dirname, 'services', 'analytics', 'statistics.js')));
app.get('/', (req, res) => res.sendFile(path.join(publicRoot, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(publicRoot, 'index.html')));
const publicTypes = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.woff', '.woff2']);
for (const directory of ['app', 'assets', 'images']) {
  app.use('/' + directory, (req, res, next) => {
    if (req.path.endsWith('/') || publicTypes.has(path.extname(req.path).toLowerCase())) return next();
    return res.sendStatus(404);
  }, express.static(path.join(publicRoot, directory), { dotfiles: 'deny', index: 'index.html' }));
}

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

// â⬝��â⬝�� Telemetria de Infraestrutura e Health Checks â⬝��â⬝��
app.get('/api/azure/health', (req, res) => {
    res.status(200).json({
        status: 'operational',
        azure: { connected: false, message: 'Provisionamento de credenciais pendente' },
        timestamp: new Date().toISOString()
    });
});

app.get('/api/plans', (req, res) => {
    res.status(200).json([
        { id: 'starter', name: 'Starter', price: 0, features: ['100 materiais', '1 usuÒ¡rio', 'Dashboard bÒ¡sico'] },
        { id: 'pro', name: 'Pro', price: 19.90, features: ['Ilimitado', '5 usuÒ¡rios', 'Azure integrado', 'Mapa 2D'] },
        { id: 'personalizado', name: 'Personalizado', price: null, features: ['Tudo do Pro', 'Ilimitado', 'SLA personalizado', 'Suporte 24/7'] },
    ]);
});

app.get('/api/health', async (req, res) => {
    const dbOk = await testConnection();
    res.status(dbOk ? 200 : 503).json({
        status: dbOk ? 'operational' : 'degraded',
        database: dbOk ? 'connected' : 'disconnected',
        application: 'astha-raven-web',
        revision: 'web-2026-10-03-unified',
        build: WEB_BUILD,
        ...(process.env.ASTHA_ACTIVE_WEB_PROFILE === 'local' ? { environment: 'local-test' } : {}),
        timestamp: new Date().toISOString()
    });
});

// â⬝��â⬝�� Manipulador Global de ExceÒ§Òµes â⬝��â⬝��
app.use((err, req, res, next) => {
    console.error('[HTTP_ERROR]', Number.isInteger(err.status) ? err.status : 500);
    res.status([400,403,413].includes(err.status) ? err.status : 500).json({ error: 'Falha catastrÒ³fica interna no servidor da API' });
});

// â⬝��â⬝�� Ciclo de Vida e InicializaÒ§Ò£o (Bootstrap) â⬝��â⬝��
async function startServer() {
    // Reserve the port before database/schema work: duplicate starts fail immediately.
    const net = require('net');
    const reservation = net.createServer();
    try {
      await new Promise((resolve,reject) => {
        reservation.once('error',reject);
        reservation.listen(PORT,HOST,resolve);
      });
    } catch (error) {
      console.error(error.code === 'EADDRINUSE' ? 'A porta ' + PORT + ' já está em uso. A API já pode estar em execução.' : 'Não foi possível reservar a porta HTTP.');
      await pool.end();process.exitCode=1;return;
    }
    const dbOk = await testConnection();
    if (dbOk) {
      try { await ensureOrgWorkspace(); }
      catch (error) { console.error('[ORG_WORKSPACE_SCHEMA]',error.code || 'Falha de inicialização'); }
    }
    await new Promise(resolve => reservation.close(resolve));
    console.log('ASTHA RAVEN - API Server v2.0');
    console.log(dbOk ? 'Banco de dados conectado.' : 'Banco de dados indisponível.');
    const server=app.listen(PORT,HOST,()=>{
      console.log('API disponível na porta ' + PORT);
      if (process.send) process.send({type:'astha-api-ready'});
    });
    const stopAnalytics = require('./routes/analytics').startProcessor();
    server.on('error',async error=>{
      console.error(error.code === 'EADDRINUSE' ? 'A porta HTTP foi ocupada por outra instância.' : 'Não foi possível iniciar a API.');
      await pool.end();process.exitCode=1;
    });
    let closing=false;
    const exitProcess=()=>{
      if(closing)return;closing=true;
      stopAnalytics();
      server.close(async()=>{await pool.end();process.exit(0);});
      setTimeout(()=>process.exit(0),10000).unref();
    };
    process.on('SIGINT',exitProcess);process.on('SIGTERM',exitProcess);
    process.on('disconnect',exitProcess);
    return server;
}

if (require.main === module) startServer();
module.exports = { app, startServer };
