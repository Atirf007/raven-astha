/* ============================================================
   Auth Routes ï¿½  /api/auth  (SEGURA ï¿½  v2)
   Fixes: JWT secret check, org_id from DB, invite join,
          onboarding setup_done, org creation on register
   ============================================================ */
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../database/connection');

const router = express.Router();

// ï¿½ ï¿½ï¿½ ï¿½ SECURITY: reject server start if no real secret ï¿½ ï¿½ï¿½ ï¿½ï¿½ ï¿½ï¿½ ï¿½ï¿½ ï¿½ï¿½ ï¿½ï¿½ ï¿½ï¿½ ï¿½ï¿½ ï¿½ï¿½ ï¿½
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[SECURITY] ERRO CRÃTICO: JWT_SECRET nÃ£o definido ou muito curto no .env!');
  console.error('[SECURITY] Defina JWT_SECRET com pelo menos 32 caracteres aleatÃ³rios.');
  // In dev, use fallback but warn loudly; in prod we should crash
  if (process.env.NODE_ENV === 'production') process.exit(1);
}
const EFFECTIVE_SECRET = JWT_SECRET || 'dev-only-secret-must-change-in-production-min32';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '30d'; // 30 days ï¿½ long enough for work sessions


// ï¿½ï¿½ï¿½ï¿½ Helper: generate a unique org_id ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½
function genOrgId() {
  return 'org_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

// ï¿½ï¿½ï¿½ï¿½ Helper: generate JWT ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, org_id: user.org_id },
    EFFECTIVE_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ï¿½ï¿½ï¿½ï¿½ Helper: store session ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½
async function storeSession(userId, token, req) {
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await pool.execute(
    `INSERT INTO sessions (user_id, token, provider, ip_address, user_agent, expires_at)
     VALUES (?, ?, 'local', ?, ?, ?)`,
    [userId, token, req.ip, req.get('User-Agent') || '', expiresAt]
  );
}

// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// POST /api/auth/register
// Creates user + org in one atomic flow
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
router.post('/register', async (req, res) => {
  try {
    const { name, surname, email, password, invite_code, dob, gender, country, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha sÃ£o obrigatÃ³rios' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
    }

    // Check existing email
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email jÃ¡ cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 12); // cost 12
    let orgId = null;
    let userRole = 'superadmin'; // founder of new org = superadmin
    let setupDone = 0;

    // ï¿½ ï¿½ï¿½ ï¿½ Case A: Invite code provided ï¿½  join existing org ï¿½ ï¿½ï¿½ ï¿½
    if (invite_code) {
      const code = invite_code.toUpperCase().trim();
      const [invites] = await pool.execute(
        'SELECT * FROM org_invites WHERE code = ? AND used_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())',
        [code]
      );

      if (invites.length === 0) {
        return res.status(400).json({ error: 'CÃ³digo de convite invÃ¡lido ou expirado' });
      }

      const invite = invites[0];
      orgId = invite.org_id;
      userRole = invite.role;

      // Create user
      const [result] = await pool.execute(
        `INSERT INTO users (name, surname, email, password_hash, role, org_id, provider, setup_done, position_id, dob, gender, country, phone)
         VALUES (?, ?, ?, ?, ?, ?, 'local', 1, ?, ?, ?, ?, ?)`,
        [name, surname || '', email.toLowerCase().trim(), hashedPassword, userRole, orgId, invite.position_id || null, dob || null, gender || null, country || null, phone || null]
      );
      const userId = result.insertId;

      // Mark invite as used
      await pool.execute(
        'UPDATE org_invites SET used_by = ?, used_at = NOW() WHERE id = ?',
        [userId, invite.id]
      );

      const token = signToken({ id: userId, email, role: userRole, org_id: orgId });
      await storeSession(userId, token, req);

      return res.status(201).json({
        token,
        user: { id: userId, name, email: email.toLowerCase().trim(), role: userRole, org_id: orgId },
        setup_done: true,
        message: 'Conta criada e vinculada Ã  organizaÃ§Ã£o com sucesso!'
      });
    }

    // ï¿½ ï¿½ï¿½ ï¿½ Case B: New user ï¿½  will create/select org in onboarding ï¿½ ï¿½ï¿½ ï¿½
    // Create a pending org (setup_done=0) that will be filled during onboarding
    orgId = genOrgId();
    await pool.execute(
      `INSERT INTO organizations (id, name, plan, setup_done) VALUES (?, ?, 'starter', 0)`,
      [orgId, `OrganizaÃ§Ã£o de ${name}`]
    );

    const [result] = await pool.execute(
      `INSERT INTO users (name, surname, email, password_hash, role, org_id, provider, setup_done, dob, gender, country, phone)
       VALUES (?, ?, ?, ?, 'superadmin', ?, 'local', 0, ?, ?, ?, ?)`,
      [name, surname || '', email.toLowerCase().trim(), hashedPassword, orgId, dob || null, gender || null, country || null, phone || null]
    );
    const userId = result.insertId;

    // Set owner_id on org
    await pool.execute('UPDATE organizations SET owner_id = ? WHERE id = ?', [userId, orgId]);

    await pool.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'CREATE', 'user', ?, ?)`,
      [userId, userId, req.ip]
    );

    const token = signToken({ id: userId, email: email.toLowerCase().trim(), role: 'superadmin', org_id: orgId });
    await storeSession(userId, token, req);

    res.status(201).json({
      token,
      user: { id: userId, name, email: email.toLowerCase().trim(), role: 'superadmin', org_id: orgId },
      setup_done: false, // triggers onboarding
      redirect: '/app/onboarding.html'
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro ao registrar' });
  }
});

// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// POST /api/auth/login
// Always fetches org_id from DB (never trusts JWT alone)
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sÃ£o obrigatÃ³rios' });
    }

    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.company, u.avatar_url,
              u.org_id, u.sector, u.is_active, u.setup_done, u.position_label,
              u.dob, u.gender, u.country, u.phone,
              o.setup_done AS org_setup_done, o.name AS org_name
       FROM users u
       LEFT JOIN organizations o ON u.org_id = o.id
       WHERE u.email = ?`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais invÃ¡lidas' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Conta desativada. Entre em contato com o suporte.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais invÃ¡lidas' });
    }

    // org_id ALWAYS comes from DB
    const orgId = user.org_id || null;
    const setupDone = user.setup_done === 1 && user.org_setup_done === 1;

    const token = signToken({ id: user.id, email: user.email, role: user.role, org_id: orgId });

    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await pool.execute(
      `INSERT INTO sessions (user_id, token, provider, ip_address, user_agent, expires_at)
       VALUES (?, ?, 'local', ?, ?, ?)`,
      [user.id, token, req.ip, req.get('User-Agent') || '', expiresAt]
    );

    await pool.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'LOGIN', 'user', ?, ?)`,
      [user.id, user.id, req.ip]
    );

    res.json({
      token,
      setup_done: setupDone,
      redirect: setupDone ? null : '/app/onboarding.html',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        org_id: orgId,
        org_name: user.org_name,
        position_label: user.position_label,
        sector: user.sector || '',
        company: user.company || '',
        avatar_url: user.avatar_url
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// POST /api/auth/logout
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      await pool.execute('DELETE FROM sessions WHERE token = ?', [token]);
      try {
        const decoded = jwt.verify(token, EFFECTIVE_SECRET);
        await pool.execute(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'LOGOUT', 'user', ?, ?)`,
          [decoded.id, decoded.id, req.ip]
        );
      } catch (_) {}
    }
    res.json({ message: 'Logout realizado' });
  } catch (err) {
    res.json({ message: 'Logout realizado' });
  }
});

// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// GET /api/auth/me ï¿½ verify token + return fresh user data
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
const authMiddleware = require('../middleware/auth');

router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Always fetch fresh data from DB ï¿½ never trust JWT payload alone
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.surname, u.email, u.company, u.phone, u.role,
              u.avatar_url, u.org_id, u.sector, u.created_at, u.setup_done, u.position_label, u.dob, u.gender, u.country,
              o.name AS org_name, o.setup_done AS org_setup_done, o.logo_url AS org_logo
       FROM users u
       LEFT JOIN organizations o ON u.org_id = o.id
       WHERE u.id = ? AND u.is_active = 1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado' });
    const user = rows[0];
    user.setup_done = user.setup_done === 1 && user.org_setup_done === 1;
    res.json(user);
  } catch (err) {
    console.error('GET /auth/me error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});


// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// PUT /api/auth/profile
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, surname, company, phone, sector, avatar_url, dob, gender, country } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome Ã© obrigatÃ³rio' });
    await pool.execute(
      `UPDATE users SET name=?, surname=?, company=?, phone=?, sector=?, avatar_url=?, dob=?, gender=?, country=? WHERE id=?`,
      [name, surname || '', company || '', phone || '', sector || '', avatar_url || null, dob || null, gender || null, country || null, req.user.id]
    );
    res.json({ message: 'Perfil atualizado' });
  } catch (err) {
    console.error('PUT /auth/profile error:', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// POST /api/auth/check-invite ï¿½ validate code before register
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
router.post('/check-invite', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'CÃ³digo invÃ¡lido' });
    const [rows] = await pool.execute(
      `SELECT i.code, i.role, i.email, o.name AS org_name
       FROM org_invites i
       JOIN organizations o ON i.org_id = o.id
       WHERE i.code = ? AND i.used_by IS NULL AND i.expires_at > NOW()`,
      [code.toUpperCase().trim()]
    );
    if (!rows.length) return res.status(404).json({ error: 'CÃ³digo invÃ¡lido ou expirado' });
    res.json({ valid: true, org_name: rows[0].org_name, role: rows[0].role, email: rows[0].email });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar convite' });
  }
});

// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// GET /api/auth/users ï¿½ list users in same org (admin only)
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
router.get('/users', authMiddleware, async (req, res) => {
  try {
    if (!['superadmin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissÃ£o' });
    }
    // CRITICAL: only return users from the SAME ORG (fetch org_id from DB)
    const [me] = await pool.execute('SELECT org_id FROM users WHERE id = ?', [req.user.id]);
    if (!me.length) return res.status(401).json({ error: 'UsuÃ¡rio nÃ£o encontrado' });
    const orgId = me[0].org_id;

    const [rows] = await pool.execute(
      `SELECT id, name, email, role, sector, avatar_url, is_active, created_at, position_label
       FROM users WHERE org_id = ? ORDER BY name ASC`,
      [orgId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar usuÃ¡rios' });
  }
});

// ï¿½ï¿½ï¿½ï¿½ Remaining legacy routes (invite, update-user, change-password, etc) ï¿½ï¿½ï¿½ï¿½

router.put('/users/:id/role', authMiddleware, async (req, res) => {
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissÃ£o' });
  }
  try {
    // IDOR: verify target user belongs to same org
    const [target] = await pool.execute(
      'SELECT id FROM users WHERE id = ? AND org_id = ?',
      [req.params.id, req.user.org_id]
    );
    if (!target.length) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado nesta organizaÃ§Ã£o' });

    const { role, sector } = req.body;
    const validRoles = ['superadmin', 'admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Role invÃ¡lida' });

    await pool.execute(
      'UPDATE users SET role = ?, sector = ? WHERE id = ? AND org_id = ?',
      [role, sector || '', req.params.id, req.user.org_id]
    );
    res.json({ message: 'UsuÃ¡rio atualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar usuÃ¡rio' });
  }
});

router.delete('/users/:id', authMiddleware, async (req, res) => {
  if (!['superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Apenas superadmin pode remover usuÃ¡rios' });
  }
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'NÃ£o Ã© possÃ­vel remover sua prÃ³pria conta' });
  }
  try {
    const [target] = await pool.execute(
      'SELECT id FROM users WHERE id = ? AND org_id = ?',
      [req.params.id, req.user.org_id]
    );
    if (!target.length) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado nesta organizaÃ§Ã£o' });
    await pool.execute('UPDATE users SET is_active = 0 WHERE id = ? AND org_id = ?', [req.params.id, req.user.org_id]);
    res.json({ message: 'UsuÃ¡rio desativado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover usuÃ¡rio' });
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'Senha nova invÃ¡lida (mÃ­nimo 8 caracteres)' });
    }
    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado' });
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
    const newHash = await bcrypt.hash(new_password, 12);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    // Invalidate all other sessions
    await pool.execute('DELETE FROM sessions WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Senha alterada com sucesso. FaÃ§a login novamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

module.exports = router;


