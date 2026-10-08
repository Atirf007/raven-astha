/* ============================================================
   Movements Routes — /api/movements (MySQL-backed)
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware); // ← All routes require valid JWT

// ── GET /api/movements ──
router.get('/', async (req, res) => {
  try {
    const { material_code, type, limit: rowLimit } = req.query;
    let sql = `
      SELECT m.*, mat.description AS material_desc, mat.code AS material_code
      FROM movements m
      JOIN materials mat ON m.material_id = mat.id
    `;
    const params = [];
    const conditions = [];

    if (material_code) {
      conditions.push('mat.code = ?');
      params.push(material_code);
    }
    if (type) {
      conditions.push('m.type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY m.created_at DESC';

    if (rowLimit) {
      sql += ' LIMIT ?';
      params.push(parseInt(rowLimit, 10));
    }

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /movements error:', err);
    res.status(500).json({ error: 'Erro ao buscar movimentações' });
  }
});

// ── POST /api/movements/entry — Entrada de material ──
router.post('/entry', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { code, quantity, nf_number, responsible, reason, notes } = req.body;
    if (!code || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Código e quantidade (> 0) são obrigatórios' });
    }

    await connection.beginTransaction();

    // Find material
    const [materials] = await connection.execute(
      'SELECT id, quantity AS current_qty FROM materials WHERE code = ?',
      [code]
    );
    if (materials.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Material não encontrado' });
    }

    const material = materials[0];
    const qty = parseInt(quantity, 10);

    // Update stock
    await connection.execute(
      'UPDATE materials SET quantity = quantity + ? WHERE id = ?',
      [qty, material.id]
    );

    // Record movement
    const [result] = await connection.execute(
      `INSERT INTO movements (material_id, type, quantity, nf_number, responsible, reason, notes)
       VALUES (?, 'entrada', ?, ?, ?, ?, ?)`,
      [material.id, qty, nf_number || null, responsible || 'Sistema', reason || null, notes || null]
    );

    await connection.commit();

    res.status(201).json({
      id: result.insertId,
      material_code: code,
      type: 'entrada',
      quantity: qty,
      new_stock: material.current_qty + qty,
      nf_number,
      responsible: responsible || 'Sistema'
    });
  } catch (err) {
    await connection.rollback();
    console.error('POST /movements/entry error:', err);
    res.status(500).json({ error: 'Erro ao registrar entrada' });
  } finally {
    connection.release();
  }
});

// ── POST /api/movements/exit — Saída de material ──
router.post('/exit', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { code, quantity, responsible, reason, notes } = req.body;
    if (!code || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Código e quantidade (> 0) são obrigatórios' });
    }

    await connection.beginTransaction();

    // Find material
    const [materials] = await connection.execute(
      'SELECT id, quantity AS current_qty FROM materials WHERE code = ?',
      [code]
    );
    if (materials.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Material não encontrado' });
    }

    const material = materials[0];
    const qty = parseInt(quantity, 10);

    // Stock check
    if (material.current_qty < qty) {
      await connection.rollback();
      return res.status(400).json({
        error: `Estoque insuficiente. Disponível: ${material.current_qty}, solicitado: ${qty}`
      });
    }

    // Update stock
    await connection.execute(
      'UPDATE materials SET quantity = quantity - ? WHERE id = ?',
      [qty, material.id]
    );

    // Record movement
    const [result] = await connection.execute(
      `INSERT INTO movements (material_id, type, quantity, responsible, reason, notes)
       VALUES (?, 'saida', ?, ?, ?, ?)`,
      [material.id, qty, responsible || 'Sistema', reason || null, notes || null]
    );

    await connection.commit();

    res.status(201).json({
      id: result.insertId,
      material_code: code,
      type: 'saida',
      quantity: qty,
      new_stock: material.current_qty - qty,
      responsible: responsible || 'Sistema'
    });
  } catch (err) {
    await connection.rollback();
    console.error('POST /movements/exit error:', err);
    res.status(500).json({ error: 'Erro ao registrar saída' });
  } finally {
    connection.release();
  }
});

module.exports = router;
