/* ============================================================
   OAuth Routes � /api/auth/oauth (Google + Microsoft)
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'astah-raven-secret-key-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

// ���� POST /api/auth/oauth/google � Exchange Google credential for session ����
router.post('/google', async (req, res) => {
  try {
    const { credential, name, email, picture } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email obrigatório' });
    }

    // Check if user exists
    const [existing] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    let user;

    if (existing.length > 0) {
      user = existing[0];
      // Update provider info if needed
      if (user.provider !== 'google') {
        await pool.execute(
          'UPDATE users SET provider = ?, avatar_url = ? WHERE id = ?',
          ['google', picture || user.avatar_url, user.id]
        );
      }
    } else {
      // Create new user
      const [result] = await pool.execute(
        `INSERT INTO users (name, email, password_hash, role, provider, avatar_url, is_active)
         VALUES (?, ?, '', 'viewer', 'google', ?, 1)`,
        [name || email.split('@')[0], email, picture || null]
      );
      user = { id: result.insertId, name: name || email.split('@')[0], email, role: 'viewer', avatar_url: picture };
    }

    const token = jwt.sign(
      { id: user.id, email: user.email || email, role: user.role || 'viewer', org_id: user.org_id || 'org_1' },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );

    // Store session
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.execute(
      `INSERT INTO sessions (user_id, token, provider, ip_address, user_agent, expires_at)
       VALUES (?, ?, 'google', ?, ?, ?)`,
      [user.id, token, req.ip, req.get('User-Agent') || '', expiresAt]
    );

    // Audit
    await pool.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, 'OAUTH_LOGIN', 'user', ?, ?)`,
      [user.id, user.id, req.ip]
    );

    res.json({
      token,
      user: { id: user.id, name: user.name || name, email: user.email || email, role: user.role || 'viewer', avatar_url: user.avatar_url || picture }
    });
  } catch (err) {
    console.error('OAuth Google error:', err);
    res.status(500).json({ error: 'Erro no login com Google' });
  }
});

// ���� POST /api/auth/oauth/microsoft � Exchange Microsoft token for session ����
router.post('/microsoft', async (req, res) => {
  try {
    const { name, email, oid } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email obrigatório' });
    }

    const [existing] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    let user;

    if (existing.length > 0) {
      user = existing[0];
    } else {
      const [result] = await pool.execute(
        `INSERT INTO users (name, email, password_hash, role, provider, is_active)
         VALUES (?, ?, '', 'viewer', 'microsoft', 1)`,
        [name || email.split('@')[0], email]
      );
      user = { id: result.insertId, name: name || email.split('@')[0], email, role: 'viewer' };
    }

    const token = jwt.sign(
      { id: user.id, email: user.email || email, role: user.role || 'viewer', org_id: user.org_id || 'org_1' },
      JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.execute(
      `INSERT INTO sessions (user_id, token, provider, ip_address, user_agent, expires_at)
       VALUES (?, ?, 'microsoft', ?, ?, ?)`,
      [user.id, token, req.ip, req.get('User-Agent') || '', expiresAt]
    );

    await pool.execute(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, 'OAUTH_LOGIN', 'user', ?, ?)`,
      [user.id, user.id, req.ip]
    );

    res.json({
      token,
      user: { id: user.id, name: user.name || name, email: user.email || email, role: user.role || 'viewer' }
    });
  } catch (err) {
    console.error('OAuth Microsoft error:', err);
    res.status(500).json({ error: 'Erro no login com Microsoft' });
  }
});

module.exports = router;

