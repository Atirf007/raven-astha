/* ============================================================
   Materials Routes — /api/materials (MySQL-backed)
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const authMiddleware = require('../middleware/auth');
const { requireRoles } = require('../security/authorization');
const stockContext=require('../services/warehouse-context');
const {validateMaterialValues}=require('../services/material-values');

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
router.post('/', requireRoles('superadmin', 'admin', 'manager', 'operator'), async (req, res) => {
  try {
    validateMaterialValues(req.body);
    const {
      code, description, brand, model, sector, location, origin_country,
      quantity, min_qty, max_qty, unit_price, currency, unit,
      image_url, image_data, manual_url, manual_data, manual_filename,
      interchangeable, interchange_with, notes, machinery,
      machinery_image, machinery_desc, usage_desc, manufacturer_url
    } = req.body;

    if (origin_country !== undefined && origin_country !== null && (typeof origin_country !== 'string' || origin_country.length > 100)) return res.status(400).json({ error: 'Origem da peça inválida' });
    if (!description) {
      return res.status(400).json({ error: 'Descrição obrigatória' });
    }

    const stock=await stockContext.warehouse(pool,req.user.org_id,req.body.warehouse_id);
    const safeLocation=await stockContext.validatePosition(pool,req.user.org_id,stock.id,location);
    // Auto-generate code if not provided
    let materialCode = code;
    if (!materialCode) {
      const [maxRow] = await pool.execute(
        "SELECT code FROM materials WHERE org_id = ? AND code LIKE 'MERB-%' ORDER BY code DESC LIMIT 1",
        [req.user.org_id]
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
        code, description, brand, model, sector, location, origin_country,
        quantity, min_qty, max_qty, unit_price, currency, unit,
        image_url, image_data, manual_url, manual_data, manual_filename,
        interchangeable, interchange_with, notes, machinery,
        machinery_image, machinery_desc, usage_desc, manufacturer_url, org_id, warehouse_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        materialCode, description, brand || null, model || null,
        sector || 'Assembly', safeLocation, origin_country?.trim() || null,
        quantity || 0, min_qty || 0, max_qty || 0,
        unit_price || 0, currency || 'BRL', unit || 'UN',
        image_url || null, image_data || null,
        manual_url || null, manual_data || null, manual_filename || null,
        interchangeable ? 1 : 0, interchange_with || null,
        notes || null, machinery || null,
        machinery_image || null, machinery_desc || null,
        usage_desc || null, manufacturer_url || null, req.user.org_id,stock.id
      ]
    );

    const [created] = await pool.execute('SELECT * FROM materials WHERE id = ? AND org_id = ?', [result.insertId, req.user.org_id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error('POST /materials error:', err);
    if(err.status)return res.status(err.status).json({error:err.message});
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Código de material já existe' });
    }
    res.status(500).json({ error: 'Erro ao criar material' });
  }
});

// ── PUT /api/materials/:code ──
router.put('/:code', requireRoles('superadmin', 'admin', 'manager'), async (req, res) => {
  try {
    validateMaterialValues(req.body);
    // Check exists
    const [existing] = await pool.execute('SELECT id,warehouse_id FROM materials WHERE code = ? AND org_id = ?', [req.params.code, req.user.org_id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Material não encontrado' });
    }

    if(req.body.warehouse_id!==undefined||req.body.location!==undefined){const stock=await stockContext.warehouse(pool,req.user.org_id,req.body.warehouse_id===undefined?existing[0].warehouse_id:req.body.warehouse_id);req.body.warehouse_id=stock.id;req.body.location=await stockContext.validatePosition(pool,req.user.org_id,stock.id,req.body.location);}
    const fields = [];
    const values = [];
    const allowedFields = [
      'description', 'brand', 'model', 'sector', 'location', 'origin_country', 'warehouse_id',
      'quantity', 'min_qty', 'max_qty', 'unit_price', 'currency', 'unit',
      'image_url', 'image_data', 'manual_url', 'manual_data', 'manual_filename',
      'interchangeable', 'interchange_with', 'notes', 'machinery',
      'machinery_image', 'machinery_desc', 'usage_desc', 'manufacturer_url'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'origin_country' && (typeof req.body[field] !== 'string' || req.body[field].length > 100)) return res.status(400).json({ error: 'Origem da peça inválida' });
        fields.push(`${field} = ?`);
        values.push(field === 'interchangeable' ? (req.body[field] ? 1 : 0) : field === 'origin_country' ? req.body[field].trim() || null : req.body[field]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(req.params.code, req.user.org_id);
    await pool.execute(`UPDATE materials SET ${fields.join(', ')} WHERE code = ? AND org_id = ?`, values);

    const [updated] = await pool.execute('SELECT * FROM materials WHERE code = ? AND org_id = ?', [req.params.code, req.user.org_id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('PUT /materials/:code error:', err);
    if(err.status)return res.status(err.status).json({error:err.message});
    res.status(500).json({ error: 'Erro ao atualizar material' });
  }
});

// ── DELETE /api/materials/:code ──
router.delete('/:code', requireRoles('superadmin', 'admin', 'manager'), async (req, res) => {
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
