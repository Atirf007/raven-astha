/* ============================================================
   Components Routes — /api/components (MySQL-backed)
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use((req, res, next) => {
  if (!req.user.org_id) return res.status(403).json({ error: 'Organização obrigatória' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !['superadmin', 'admin', 'manager'].includes(req.user.role)) return res.status(403).json({ error: 'Permissão insuficiente' });
  next();
});

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
      LEFT JOIN materials m ON cm.material_id = m.id AND m.org_id = c.org_id
      WHERE c.org_id = ?
      ORDER BY c.id DESC
    `;
    
    const [rows] = await pool.execute(query, [req.user.org_id]);
    
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
    console.error('GET /components error:', err.code || err.name);
    res.status(500).json({ error: 'Erro ao buscar componentes' });
  }
});

// ── POST /api/components — Create a custom component ──
router.post('/', async (req, res) => {
  let connection;
  try {
    const { name, description, materials } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 200 ||
        (description !== undefined && (typeof description !== 'string' || description.length > 5000)) ||
        !Array.isArray(materials) || !materials.length || materials.length > 200 ||
        materials.some(item => !item || typeof item.code !== 'string' || !item.code.trim() || item.code.length > 100 ||
          !Number.isSafeInteger(item.qty ?? 1) || (item.qty ?? 1) < 1)) {
      return res.status(400).json({ error: 'Componente inválido' });
    }
    const normalizedMaterials = materials.map(item => ({ code: item.code.trim(), qty: item.qty ?? 1 }));
    if (new Set(normalizedMaterials.map(item => item.code)).size !== normalizedMaterials.length) {
      return res.status(400).json({ error: 'Material duplicado no componente' });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Insert component
    const userId = req.user ? req.user.id : null;
    const [compResult] = await connection.execute(
      'INSERT INTO components (name, description, created_by, org_id) VALUES (?, ?, ?, ?)',
      [name.trim(), description?.trim() || null, userId, req.user.org_id]
    );
    const componentId = compResult.insertId;

    // 2. Insert component materials
    for (const item of normalizedMaterials) {
      const { code, qty } = item;
      
      // Find material ID by code
      const [matRows] = await connection.execute(
        'SELECT id FROM materials WHERE code = ? AND org_id = ? FOR UPDATE',
        [code, req.user.org_id]
      );
      
      if (!matRows.length) { await connection.rollback(); return res.status(404).json({ error: 'Material não encontrado' }); }
      if (matRows.length > 0) {
        const materialId = matRows[0].id;
        await connection.execute(
          'INSERT INTO component_materials (component_id, material_id, quantity) VALUES (?, ?, ?)',
          [componentId, materialId, qty || 1]
        );
      }
    }

    await connection.commit();
    res.status(201).json({ success: true, id: componentId, name: name.trim(), description: description?.trim() || '', materials: normalizedMaterials });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('POST /components error:', err.code || err.name);
    res.status(500).json({ error: 'Erro ao criar componente' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
