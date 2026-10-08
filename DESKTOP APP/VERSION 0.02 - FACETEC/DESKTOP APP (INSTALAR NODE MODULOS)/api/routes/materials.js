/* ============================================================
   Materials Routes — /api/materials (MySQL-backed)
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/materials ──
router.get('/', async (req, res) => {
  try {
    const { sector, search, warehouse_id } = req.query;
    let sql = 'SELECT * FROM materials WHERE is_active = 1 AND org_id = ?';
    const params = [req.user.org_id];

    if (warehouse_id) {
      sql += ' AND warehouse_id = ?';
      params.push(warehouse_id);
    }

    if (sector) {
      sql += ' AND sector = ?';
      params.push(sector);
    }

    if (search) {
      sql += ' AND (code LIKE ? OR description LIKE ? OR brand LIKE ? OR model LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY code ASC';

    const [rows] = await pool.execute(sql, params);
    // Frontend expects raw array via api.js wrapper ({success:true, data: rows})
    res.json(rows);
  } catch (err) {
    console.error('GET /materials error:', err);
    res.status(500).json({ error: 'Erro ao buscar materiais' });
  }
});

// ── GET /api/materials/:identifier (code string OR numeric id) ──
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const isNumericId = /^\d+$/.test(identifier);
    const sql = isNumericId
      ? 'SELECT * FROM materials WHERE id = ? AND org_id = ?'
      : 'SELECT * FROM materials WHERE code = ? AND org_id = ?';
    const [rows] = await pool.execute(sql, [identifier, req.user.org_id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Material não encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /materials/:identifier error:', err);
    res.status(500).json({ error: 'Erro ao buscar material' });
  }
});

// ── POST /api/materials ──
router.post('/', async (req, res) => {
  try {
    const {
      code, description, brand, model, sector, location,
      quantity, min_qty, max_qty, unit_price, currency, unit,
      image_url, image_data, manual_url, manual_data, manual_filename,
      interchangeable, interchange_with, notes, machinery,
      machinery_image, machinery_desc, usage_desc, manufacturer_url
    } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Descrição obrigatória' });
    }

    // Auto-generate code if not provided
    let materialCode = code;
    if (!materialCode) {
      const [maxRow] = await pool.execute(
        "SELECT code FROM materials WHERE code LIKE 'MERB-%' ORDER BY code DESC LIMIT 1"
      );
      if (maxRow.length > 0) {
        const num = parseInt(maxRow[0].code.replace('MERB-', ''), 10) + 1;
        materialCode = 'MERB-' + String(num).padStart(8, '0');
      } else {
        materialCode = 'MERB-00000001';
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO materials (
        code, description, brand, model, sector, location,
        quantity, min_qty, max_qty, unit_price, currency, unit,
        image_url, image_data, manual_url, manual_data, manual_filename,
        interchangeable, interchange_with, notes, machinery,
        machinery_image, machinery_desc, usage_desc, manufacturer_url, org_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        materialCode, description, brand || null, model || null,
        sector || 'Assembly', location || null,
        quantity || 0, min_qty || 0, max_qty || 0,
        unit_price || 0, currency || 'BRL', unit || 'UN',
        image_url || null, image_data || null,
        manual_url || null, manual_data || null, manual_filename || null,
        interchangeable ? 1 : 0, interchange_with || null,
        notes || null, machinery || null,
        machinery_image || null, machinery_desc || null,
        usage_desc || null, manufacturer_url || null, req.user.org_id
      ]
    );

    const [created] = await pool.execute('SELECT * FROM materials WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error('POST /materials error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Código de material já existe' });
    }
    res.status(500).json({ error: `Erro ao criar material: ${err.message}` });
  }
});

// ── PUT /api/materials/:code ──
router.put('/:code', async (req, res) => {
  try {
    // Check exists
    const [existing] = await pool.execute('SELECT id FROM materials WHERE code = ? AND org_id = ?', [req.params.code, req.user.org_id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Material não encontrado' });
    }

    const fields = [];
    const values = [];
    const allowedFields = [
      'description', 'brand', 'model', 'sector', 'location',
      'quantity', 'min_qty', 'max_qty', 'unit_price', 'currency', 'unit',
      'image_url', 'image_data', 'manual_url', 'manual_data', 'manual_filename',
      'interchangeable', 'interchange_with', 'notes', 'machinery',
      'machinery_image', 'machinery_desc', 'usage_desc', 'manufacturer_url'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(field === 'interchangeable' ? (req.body[field] ? 1 : 0) : req.body[field]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(req.params.code, req.user.org_id);
    await pool.execute(`UPDATE materials SET ${fields.join(', ')} WHERE code = ? AND org_id = ?`, values);

    const [updated] = await pool.execute('SELECT * FROM materials WHERE code = ?', [req.params.code]);
    res.json(updated[0]);
  } catch (err) {
    console.error('PUT /materials/:code error:', err);
    res.status(500).json({ error: 'Erro ao atualizar material' });
  }
});

// ── DELETE /api/materials/:code ──
router.delete('/:code', async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT id FROM materials WHERE code = ? AND org_id = ?', [req.params.code, req.user.org_id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Material não encontrado' });
    }

    await pool.execute('UPDATE materials SET is_active = 0 WHERE code = ? AND org_id = ?', [req.params.code, req.user.org_id]);
    res.json({ message: 'Material removido' });
  } catch (err) {
    console.error('DELETE /materials/:code error:', err);
    res.status(500).json({ error: 'Erro ao excluir material' });
  }
});

module.exports = router;
