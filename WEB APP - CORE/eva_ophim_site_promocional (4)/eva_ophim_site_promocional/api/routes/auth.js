/* ============================================================
   Auth Routes ï¿½ /api/auth  (SEGURA ï¿½ v2)
   Fixes: JWT secret check, org_id from DB, invite join,
          onboarding setup_done, org creation on register
   ============================================================ */
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validPassword, PASSWORD_ERROR } = require('../security/password-policy');
const dummyHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 12);
const passwordLimiter = require('express-rate-limit')({ windowMs: 5*60*1000, max: 5, standardHeaders:true, legacyHeaders:false, keyGenerator:req=>String(req.user.org_id)+':'+String(req.user.id), message:{error:'Muitas tentativas. Aguarde 5 minutos.'} });
const { pool, readWithRetry } = require('../database/connection');

const router = express.Router();

// ï¿½ï¿½ï¿½ï¿½ SECURITY: reject server start if no real secret ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½
const { signToken, verifyToken, expiresAt } = require('../security/tokens');
const { validRoleChange } = require('../security/authorization');



// ï¿½ï¿½ï¿½ï¿½ Helper: generate a unique org_id ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½
function genOrgId() {
  return 'org_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

// ï¿½ï¿½ï¿½ï¿½ Helper: generate JWT ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½


// ï¿½ï¿½ï¿½ï¿½ Helper: store session ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½
async function storeSession(userId, token, req, db = pool) {
  const sessionExpiry = expiresAt(token);
  await db.execute(
    `INSERT INTO sessions (user_id, token, provider, ip_address, user_agent, expires_at)
     VALUES (?, ?, 'local', ?, ?, ?)`,
    [userId, token, req.ip, req.get('User-Agent') || '', sessionExpiry]
  );
}

// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// POST /api/auth/register
// Creates user + org in one atomic flow
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
router.post('/register', async (req, res) => {
  let connection;
  try {
    const { name, surname, email, password, invite_code, dob, gender, country, phone } = req.body;

    if (typeof name !== 'string' || !name.trim() || name.length > 100 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 || typeof password !== 'string') {
      return res.status(400).json({ error: 'Informe nome, e-mail e senha válidos' });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ error: PASSWORD_ERROR });
    }
    if ((surname != null && (typeof surname !== 'string' || surname.length > 100))
      || (country != null && (typeof country !== 'string' || country.length > 100))
      || (phone != null && (typeof phone !== 'string' || phone.length > 30))
      || (gender != null && (typeof gender !== 'string' || gender.length > 30))
      || (dob && (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob)))) {
      return res.status(400).json({ error: 'Confira os dados do perfil' });
    }

    // Check existing email
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 12); // cost 12
    let orgId = null;
    let userRole = 'superadmin'; // founder of new org = superadmin
    let setupDone = 0;

    // ï¿½ ï¿½ï¿½ ï¿½ Case A: Invite code provided ï¿½  join existing org ï¿½ ï¿½ï¿½ ï¿½
    if (invite_code != null && (typeof invite_code !== 'string' || !/^[a-z0-9-]{6,20}$/i.test(invite_code.trim()))) {
      return res.status(400).json({ error: 'Código de convite inválido' });
    }
    if (invite_code) {
      const code = invite_code.toUpperCase().trim();
      const [invites] = await pool.execute(
        'SELECT * FROM org_invites WHERE code = ? AND used_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())',
        [code]
      );

      if (invites.length === 0) {
        return res.status(400).json({ error: 'Código de convite inválido ou expirado' });
      }

      const invite = invites[0];
      const normalizedEmail = email.toLowerCase().trim();
      if ((invite.email && invite.email.toLowerCase().trim() !== normalizedEmail) || !['admin', 'manager', 'operator', 'viewer'].includes(invite.role)) {
        return res.status(400).json({ error: 'Código de convite inválido ou expirado' });
      }
      orgId = invite.org_id;
      userRole = invite.role;

      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [claimed] = await connection.execute(
        'UPDATE org_invites SET used_at = NOW() WHERE id = ? AND used_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())',
        [invite.id]
      );
      if (claimed.affectedRows !== 1) {
        await connection.rollback();
        return res.status(400).json({ error: 'Código de convite inválido ou expirado' });
      }

      // Create user
      const [result] = await connection.execute(
        `INSERT INTO users (name, surname, email, password_hash, role, org_id, provider, setup_done, position_id, dob, gender, country, phone)
         VALUES (?, ?, ?, ?, ?, ?, 'local', 1, ?, ?, ?, ?, ?)`,
        [name, surname || '', email.toLowerCase().trim(), hashedPassword, userRole, orgId, invite.position_id || null, dob || null, gender || null, country || null, phone || null]
      );
      const userId = result.insertId;

      // Mark invite as used
      await connection.execute(
        'UPDATE org_invites SET used_by = ? WHERE id = ? AND used_at IS NOT NULL',
        [userId, invite.id]
      );

      const token = signToken({ id: userId, email, role: userRole, org_id: orgId });
      await storeSession(userId, token, req, connection);
      await connection.commit();

      return res.status(201).json({
        token,
        user: { id: userId, name, surname: surname || '', email: email.toLowerCase().trim(), role: userRole, org_id: orgId, dob: dob || null, gender: gender || null, country: country || null, phone: phone || null },
        setup_done: true,
        message: 'Conta criada e vinculada à organização com sucesso!'
      });
    }

    // ï¿½ ï¿½ï¿½ ï¿½ Case B: New user ï¿½  will create/select org in onboarding ï¿½ ï¿½ï¿½ ï¿½
    // Create a pending org (setup_done=0) that will be filled during onboarding
    orgId = genOrgId();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO organizations (id, name, plan, setup_done) VALUES (?, ?, 'starter', 0)`,
      [orgId, `Organização de ${name.trim()}`]
    );

    const [result] = await connection.execute(
      `INSERT INTO users (name, surname, email, password_hash, role, org_id, provider, setup_done, dob, gender, country, phone)
       VALUES (?, ?, ?, ?, 'superadmin', ?, 'local', 0, ?, ?, ?, ?)`,
      [name, surname || '', email.toLowerCase().trim(), hashedPassword, orgId, dob || null, gender || null, country || null, phone || null]
    );
    const userId = result.insertId;

    // Set owner_id on org
    await connection.execute('UPDATE organizations SET owner_id = ? WHERE id = ?', [userId, orgId]);

    await connection.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'CREATE', 'user', ?, ?)`,
      [userId, userId, req.ip]
    );

    const token = signToken({ id: userId, email: email.toLowerCase().trim(), role: 'superadmin', org_id: orgId });
    await storeSession(userId, token, req, connection);
    await connection.commit();

    res.status(201).json({
      token,
      user: { id: userId, name, surname: surname || '', email: email.toLowerCase().trim(), role: 'superadmin', org_id: orgId, dob: dob || null, gender: gender || null, country: country || null, phone: phone || null },
      setup_done: false, // triggers onboarding
      redirect: '/app/onboarding.html'
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('Register error:', err.code || err.name);
    res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'E-mail já cadastrado' : 'Erro ao registrar' });
  } finally {
    if (connection) connection.release();
  }
});

// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// POST /api/auth/login
// Always fetches org_id from DB (never trusts JWT alone)
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
router.post('/login', async (req, res) => {
  let stage = 'validation';
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || email.length > 255 || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    stage = 'lookup';
    const [rows] = await readWithRetry(
      `SELECT u.id, u.name, u.surname, u.email, u.password_hash, u.role, u.company, u.avatar_url,
              u.org_id, u.sector, u.is_active, u.setup_done, u.position_label,
              u.dob, u.gender, u.country, u.phone,
              o.setup_done AS org_setup_done, o.name AS org_name
       FROM users u
       LEFT JOIN organizations o ON u.org_id = o.id
       WHERE u.email = ?`,
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    stage = 'password';
    const valid = await bcrypt.compare(password, user?.password_hash || dummyHash);
    if (!user || !user.is_active || !valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    // org_id ALWAYS comes from DB
    const orgId = user.org_id || null;
    const setupDone = user.setup_done === 1 && user.org_setup_done === 1;

    stage = 'token';
    const token = signToken({ id: user.id, email: user.email, role: user.role, org_id: orgId });

    stage = 'session';
    const sessionExpiry = expiresAt(token);
    await pool.execute(
      `INSERT INTO sessions (user_id, token, provider, ip_address, user_agent, expires_at)
       VALUES (?, ?, 'local', ?, ?, ?)`,
      [user.id, token, req.ip, req.get('User-Agent') || '', sessionExpiry]
    );

    stage = 'audit';
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
        avatar_url: user.avatar_url,
        surname: user.surname || '', dob: user.dob, gender: user.gender,
        country: user.country, phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login error:', stage, err.code || err.name || 'unknown');
    const databaseUnavailable = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'EPIPE'].includes(err.code);
    res.status(databaseUnavailable ? 503 : 500).json({ error: databaseUnavailable ? 'Conexão com banco indisponível. Tente novamente.' : 'Erro ao fazer login' });
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
        const decoded = verifyToken(token);
        await pool.execute(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'LOGOUT', 'user', ?, ?)`,
          [decoded.id, decoded.id, req.ip]
        );
      } catch (_) {}
    }
    res.json({ message: 'Logout realizado' });
  } catch (err) {
    res.status(503).json({ error: 'Não foi possível encerrar a sessão' });
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
              o.name AS org_name, o.setup_done AS org_setup_done, o.logo_url AS org_logo, o.workspace_type, o.plan AS org_plan
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
    console.error('GET /auth/me error:');
    res.status(500).json({ error: 'Erro interno' });
  }
});


// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// PUT /api/auth/profile
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const limits = { name: 100, surname: 100, company: 200, phone: 30, sector: 100,
      dob: 10, gender: 60, country: 100, position_label: 160, avatar_url: 2_000_000 };
    const changes = [];
    const values = [];
    for (const [field, limit] of Object.entries(limits)) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
      const value = req.body[field];
      if (value !== null && (typeof value !== 'string' || value.length > limit)) {
        return res.status(400).json({ error: `Campo ${field} inválido` });
      }
      if (field === 'name' && (!value || !value.trim())) return res.status(400).json({ error: 'Nome é obrigatório' });
      if (field === 'dob' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return res.status(400).json({ error: 'Data inválida' });
      if (field === 'avatar_url' && value && !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)) {
        return res.status(400).json({ error: 'Imagem de perfil inválida' });
      }
      changes.push(`${field} = ?`);
      values.push(value?.trim() || null);
    }
    if (!changes.length) return res.status(400).json({ error: 'Nenhuma alteração informada' });
    await pool.execute(`UPDATE users SET ${changes.join(', ')} WHERE id = ?`, [...values, req.user.id]);
    res.json({ message: 'Perfil atualizado' });
  } catch (err) {
    console.error('PUT /auth/profile error:');
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
// POST /api/auth/check-invite ï¿½ validate code before register
// ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½ï¿½"ï¿½
router.post('/check-invite', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Código inválido' });
    const [rows] = await pool.execute(
      `SELECT i.code, i.role, i.email, o.name AS org_name
       FROM org_invites i
       JOIN organizations o ON i.org_id = o.id
       WHERE i.code = ? AND i.used_by IS NULL AND i.expires_at > NOW()`,
      [code.toUpperCase().trim()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Código inválido ou expirado' });
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
      'SELECT id, role FROM users WHERE id = ? AND org_id = ?',
      [req.params.id, req.user.org_id]
    );
    if (!target.length) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado nesta organizaÃ§Ã£o' });

    const { role, sector } = req.body;
    if (!validRoleChange(req.user, target[0], role)) return res.status(403).json({ error: 'Sem permissão para este papel' });
    const validRoles = ['superadmin', 'admin', 'manager', 'operator', 'viewer'];
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
      'SELECT id, role FROM users WHERE id = ? AND org_id = ?',
      [req.params.id, req.user.org_id]
    );
    if (!target.length) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado nesta organizaÃ§Ã£o' });
    await pool.execute('UPDATE users SET is_active = 0 WHERE id = ? AND org_id = ?', [req.params.id, req.user.org_id]);
    res.json({ message: 'UsuÃ¡rio desativado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover usuÃ¡rio' });
  }
});

router.post('/change-password', authMiddleware, passwordLimiter, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (typeof current_password !== 'string' || Buffer.byteLength(current_password,'utf8') > 72 || !validPassword(new_password)) {
      return res.status(400).json({error:PASSWORD_ERROR});
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


