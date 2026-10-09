/* ============================================================
   OAuth Routes � /api/auth/oauth (Google + Microsoft)
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');

const router = express.Router();
const { signToken, expiresAt } = require('../security/tokens');
const { verifyIdentity } = require('../security/provider-identity');

// ���� POST /api/auth/oauth/google � Exchange Google credential for session ����
router.post('/google', async (req, res) => {
  try {
    let identity;
    try { identity = await verifyIdentity('google', req.body.credential); } catch (_) { return res.status(401).json({ error: 'Identidade do provedor inválida' }); }
    const { name, email } = identity;
    const picture = null;
    if (!email) {
      return res.status(400).json({ error: 'Email obrigatório' });
    }

    // Check if user exists
    const [existing] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    let user;

    if (existing.length > 0) {
      user = existing[0];
      if (!user.is_active || user.provider !== 'google' || user.provider_id !== identity.subject || !user.org_id) return res.status(401).json({ error: 'Conta não vinculada a esta identidade' });
      // Update provider info if needed
      if (user.provider !== 'google') {
        await pool.execute(
          'UPDATE users SET provider = ?, avatar_url = ? WHERE id = ?',
          ['google', picture || user.avatar_url, user.id]
        );
      }
    } else {
      const orgId = 'org_' + require('crypto').randomUUID();
      await pool.execute("INSERT INTO organizations (id, name, plan) VALUES (?, ?, 'starter')", [orgId, name]);
      // Create new user
      const [result] = await pool.execute(
        `INSERT INTO users (name, email, password_hash, role, provider, avatar_url, is_active, org_id, provider_id)
         VALUES (?, ?, '', 'viewer', 'google', ?, 1, ?, ?)`,
        [name || email.split('@')[0], email, picture || null, orgId, identity.subject]
      );
      user = { org_id: orgId, id: result.insertId, name: name || email.split('@')[0], email, role: 'viewer', avatar_url: picture };
    }

    const token = signToken(user);

    // Store session
    const sessionExpiry = expiresAt(token);
    await pool.execute(
      `INSERT INTO sessions (user_id, token, provider, ip_address, user_agent, expires_at)
       VALUES (?, ?, 'google', ?, ?, ?)`,
      [user.id, token, req.ip, req.get('User-Agent') || '', sessionExpiry]
    );

    // Audit
    await pool.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, 'OAUTH_LOGIN', 'user', ?, ?)`,
      [user.id, user.id, req.ip]
    );

    res.json({
      token,
      user: { id: user.id, name: user.name || name, email: user.email || email, role: user.role || 'viewer', org_id: user.org_id, avatar_url: user.avatar_url || picture }
    });
  } catch (err) {
    console.error('OAuth Google error:');
    res.status(500).json({ error: 'Erro no login com Google' });
  }
});

// ���� POST /api/auth/oauth/microsoft � Exchange Microsoft token for session ����
router.post('/microsoft', async (req, res) => {
  try {
    let identity;
    try { identity = await verifyIdentity('microsoft', req.body.credential || req.body.id_token); } catch (_) { return res.status(401).json({ error: 'Identidade do provedor inválida' }); }
    const { name, email } = identity;
    if (!email) {
      return res.status(400).json({ error: 'Email obrigatório' });
    }

    const [existing] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    let user;

    if (existing.length > 0) {
      user = existing[0];
      if (!user.is_active || user.provider !== 'microsoft' || user.provider_id !== identity.subject || !user.org_id) return res.status(401).json({ error: 'Conta não vinculada a esta identidade' });
    } else {
      const orgId = 'org_' + require('crypto').randomUUID();
      await pool.execute("INSERT INTO organizations (id, name, plan) VALUES (?, ?, 'starter')", [orgId, name]);
      const [result] = await pool.execute(
        `INSERT INTO users (name, email, password_hash, role, provider, is_active, org_id, provider_id)
         VALUES (?, ?, '', 'viewer', 'microsoft', 1, ?, ?)`,
        [name || email.split('@')[0], email, orgId, identity.subject]
      );
      user = { org_id: orgId, id: result.insertId, name: name || email.split('@')[0], email, role: 'viewer' };
    }

    const token = signToken(user);

    const sessionExpiry = expiresAt(token);
    await pool.execute(
      `INSERT INTO sessions (user_id, token, provider, ip_address, user_agent, expires_at)
       VALUES (?, ?, 'microsoft', ?, ?, ?)`,
      [user.id, token, req.ip, req.get('User-Agent') || '', sessionExpiry]
    );

    await pool.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, 'OAUTH_LOGIN', 'user', ?, ?)`,
      [user.id, user.id, req.ip]
    );

    res.json({
      token,
      user: { id: user.id, name: user.name || name, email: user.email || email, role: user.role || 'viewer', org_id: user.org_id }
    });
  } catch (err) {
    console.error('OAuth Microsoft error:');
    res.status(500).json({ error: 'Erro no login com Microsoft' });
  }
});

module.exports = router;

