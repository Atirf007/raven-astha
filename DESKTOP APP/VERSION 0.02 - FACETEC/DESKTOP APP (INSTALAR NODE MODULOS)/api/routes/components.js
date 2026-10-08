/* ============================================================
   Components Routes — /api/components (MySQL-backed)
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── GET /api/components — List all custom components ──
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.id AS component_id, 
        c.name, 
        c.description, 
        cm.quantity AS qty, 
        m.code AS material_code
      FROM components c
      LEFT JOIN component_materials cm ON c.id = cm.component_id
      LEFT JOIN materials m ON cm.material_id = m.id
      ORDER BY c.id DESC
    `;
    
    const [rows] = await pool.query(query);
    
    // Group results by component id
    const componentsMap = {};
    for (const row of rows) {
      if (!row.component_id) continue;
      
      if (!componentsMap[row.component_id]) {
        componentsMap[row.component_id] = {
          id: row.component_id,
          name: row.name,
          description: row.description || '',
          materials: []
        };
      }
      
      if (row.material_code) {
        componentsMap[row.component_id].materials.push({
          code: row.material_code,
          qty: row.qty || 1
        });
      }
    }
    
    res.json(Object.values(componentsMap));
  } catch (err) {
    console.error('GET /components error:', err);
    res.status(500).json({ error: 'Erro ao buscar componentes' });
  }
});

// ── POST /api/components — Create a custom component ──
router.post('/', authMiddleware, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { name, description, materials } = req.body;
    if (!name || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: 'Nome e materiais são obrigatórios' });
    }

    await connection.beginTransaction();

    // 1. Insert component
    const userId = req.user ? req.user.id : null;
    const [compResult] = await connection.query(
      'INSERT INTO components (name, description, created_by) VALUES (?, ?, ?)',
      [name, description || null, userId]
    );
    const componentId = compResult.insertId;

    // 2. Insert component materials
    for (const item of materials) {
      const { code, qty } = item;
      
      // Find material ID by code
      const [matRows] = await connection.query(
        'SELECT id FROM materials WHERE code = ?',
        [code]
      );
      
      if (matRows.length > 0) {
        const materialId = matRows[0].id;
        await connection.query(
          'INSERT INTO component_materials (component_id, material_id, quantity) VALUES (?, ?, ?)',
          [componentId, materialId, qty || 1]
        );
      }
    }

    await connection.commit();
    res.status(201).json({ success: true, id: componentId, name, description, materials });
  } catch (err) {
    await connection.rollback();
    console.error('POST /components error:', err);
    res.status(500).json({ error: 'Erro ao criar componente' });
  } finally {
    connection.release();
  }
});

module.exports = router;
