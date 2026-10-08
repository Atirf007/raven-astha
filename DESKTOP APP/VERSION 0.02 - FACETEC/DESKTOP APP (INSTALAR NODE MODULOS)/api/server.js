/* ============================================================
   ASTAH RAVEN â��⬝ API Server (server.js)
   Express + MySQL + JWT auth, rate limiting, CORS
   ============================================================ */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// â⬝��â⬝�� AbstraÒ§Ò£o de Dados â⬝��â⬝��
const { testConnection } = require('./database/connection');

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

const app = express();
// PriorizaÒ§Ò£o estrita da variÒ¡vel de ambiente com fallback algorÒ­tmico
const PORT = process.env.PORT || 3000;

// â⬝��â⬝�� Security & Payload Middleware â⬝��â⬝��
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
// CORS: only allow configured origins (never wildcard in production)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500').split(',');
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, same-origin) or 'null' (local file:// execution)
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// â⬝��â⬝�� Network Rate Limiting â⬝��â⬝��
// General rate limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Limite de requisiÒ§Òµes excedido. Tente novamente em alguns minutos.' }
});
app.use('/api/', limiter);

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

// ���� Static Assets ����
// SECURE STATIC FILE SERVING: Prevent access to backend source code and dotfiles
app.use((req, res, next) => {
  const p = req.path;
  if (p.startsWith('/api/') && !p.startsWith('/api/auth') && !p.startsWith('/api/materials') && !p.startsWith('/api/contact') && !p.startsWith('/api/org') && !p.startsWith('/api/warehouse') && !p.startsWith('/api/movements')) {
    // If it starts with /api/ but is not a registered route, it might be trying to access the api/ folder statically
    return res.status(403).json({ error: 'Acesso negado' });
  }
  if (p.includes('/.') || p.endsWith('.js') && !p.includes('/app/') && !p.includes('/js/') && !p.includes('/ASTAH/') && !p.includes('/old/')) {
    // Block dotfiles (.env, .git) and root JS files (scripts)
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
});

// Serve a raiz (index.html �  redirect para /app)
app.use(express.static(path.join(__dirname, '..'), {
  index: ['index.html'],
  dotfiles: 'deny' // Let express handle dotfiles too
}));
// Serve /app explicitamente (programa funcional)
app.use('/app', express.static(path.join(__dirname, '..', 'app')));
// Serve /old (site promocional arquivado)
app.use('/old', express.static(path.join(__dirname, '..', 'old')));

// â⬝��â⬝�� Mapeamento de Endpoints â⬝��â⬝��
app.use('/api/auth', authRoutes);
app.use('/api/auth/oauth', oauthRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/movements', movementsRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/components', componentsRoutes);
app.use('/api/materials', materialFilesRoutes);
app.use('/api/org', organizationsRoutes);

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
        timestamp: new Date().toISOString()
    });
});

// â⬝��â⬝�� Manipulador Global de ExceÒ§Òµes â⬝��â⬝��
app.use((err, req, res, next) => {
    console.error(`[CRITICAL ERROR] EmissÒ£o de stack trace: ${err.stack}`);
    res.status(500).json({ error: 'Falha catastrÒ³fica interna no servidor da API' });
});

// â⬝��â⬝�� Ciclo de Vida e InicializaÒ§Ò£o (Bootstrap) â⬝��â⬝��
async function startServer() {
    const dbOk = await testConnection();
    
    console.log('\n â⬢⬝â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢�');
    console.log(' â⬢��      ASTAH RAVEN â��⬝ API Server v2.0      â⬢��');
    console.log(' â⬢šâ⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢â⬢\n');
    console.log(` ðŸ� Socket HTTP Habilitado: http://127.0.0.1:${PORT}`);
    console.log(` ðŸ�"¾ Integridade do SGBD:    ${dbOk ? 'â�⬦ Handshake TCP efetuado' : 'âš ï¸ Offline (Fallback acionado)'}\n`);
    
    const server = app.listen(PORT, () => {
        console.log(`[LOG] Daemon Node.js em execuÒ§Ò£o. Ouvindo porta ${PORT}.`);
    });

    // â⬝��â⬝�� Graceful Shutdown (InterpretaÒ§Ò£o de Sinais do SO) â⬝��â⬝��
    const exitProcess = () => {
        console.log('\n[SISTEMA] Interceptado sinal de interrupÒ§Ò£o (SIGINT/SIGTERM).');
        server.close(() => {
            console.log('[SISTEMA] Sockets HTTP desalocados. Processo finalizado com seguranÒ§a operacional.');
            process.exit(0);
        });
    };

    process.on('SIGINT', exitProcess);
    process.on('SIGTERM', exitProcess);
}

startServer();
