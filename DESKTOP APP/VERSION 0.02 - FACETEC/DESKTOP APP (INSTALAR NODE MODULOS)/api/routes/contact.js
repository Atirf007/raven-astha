/* ============================================================
   Contact Routes — /api/contact (MySQL-backed)
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');

const router = express.Router();

// ── POST /api/contact ──
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Nome, email e mensagem são obrigatórios' });
    }

    const [result] = await pool.execute(
      `INSERT INTO contact_messages (name, email, subject, message)
       VALUES (?, ?, ?, ?)`,
      [name, email, subject || 'Geral', message]
    );

    console.log(`📨 Nova mensagem de ${name} (${email}): ${subject || 'Geral'}`);
    res.status(201).json({ message: 'Mensagem recebida com sucesso', id: result.insertId });
  } catch (err) {
    console.error('POST /contact error:', err);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// ── GET /api/contact (admin) ──
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    if (!['superadmin', 'admin'].includes(req.user.role)) return res.status(403).json({error: 'Sem permissão'});
    const [rows] = await pool.execute(
      'SELECT * FROM contact_messages ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /contact error:', err);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

// ── PATCH /api/contact/:id/read ──
router.patch('/:id/read', authMiddleware, async (req, res) => {
  if (!['superadmin', 'admin'].includes(req.user.role)) return res.status(403).json({error: 'Sem permissão'});
  try {
    await pool.execute(
      'UPDATE contact_messages SET is_read = 1 WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Mensagem marcada como lida' });
  } catch (err) {
    console.error('PATCH /contact/:id/read error:', err);
    res.status(500).json({ error: 'Erro ao atualizar mensagem' });
  }
});

module.exports = router;
