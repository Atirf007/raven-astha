/* ============================================================
   Warehouse Routes — /api/warehouse (MySQL-backed)
   Layout, shelves, and shelf assignment management
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/warehouse/tabs — Lista os armazéns da organização ──
router.get('/tabs', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, tab_number, is_shared FROM warehouses WHERE org_id = ? ORDER BY tab_number ASC',
      [req.user.org_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /warehouse/tabs error:', err);
    res.status(500).json({ error: 'Erro ao buscar abas de armazém' });
  }
});

// ── GET /api/warehouse/layout — Active warehouse layout ──
router.get('/layout', async (req, res) => {
  try {
    let rows = [];

    // Try with org_id filter first (requires column to exist)
    try {
      [rows] = await pool.execute(
        'SELECT * FROM warehouse_layout WHERE is_active = 1 AND org_id = ? LIMIT 1',
        [req.user.org_id]
      );
    } catch (colErr) {
      // Fallback: org_id column may not exist yet — grab any active layout
      console.warn('[warehouse] org_id column missing, using fallback:', colErr.message);
      [rows] = await pool.execute('SELECT * FROM warehouse_layout WHERE is_active = 1 LIMIT 1');
    }

    if (rows.length === 0) {
      // Auto-provision default layout for the org (try with org_id, fallback without)
      try {
        await pool.execute(
          `INSERT INTO warehouse_layout (org_id, name, room_w, room_h, door_x, door_y, door_w, blueprint_data)
           VALUES (?, 'Armazém Principal', 720, 480, 620, 480, 100, '{}')`,
          [req.user.org_id]
        );
        [rows] = await pool.execute(
          'SELECT * FROM warehouse_layout WHERE is_active = 1 AND org_id = ? LIMIT 1',
          [req.user.org_id]
        );
      } catch (_) {
        await pool.execute(
          `INSERT INTO warehouse_layout (name, room_w, room_h, door_x, door_y, door_w)
           VALUES ('Armazém Principal', 720, 480, 620, 480, 100)`
        );
        [rows] = await pool.execute('SELECT * FROM warehouse_layout WHERE is_active = 1 LIMIT 1');
      }
    }

    // Parse JSON fields safely
    const layout = rows[0];
    if (typeof layout.aisles === 'string' && layout.aisles) {
      try { layout.aisles = JSON.parse(layout.aisles); } catch(e){ layout.aisles = []; }
    }
    if (typeof layout.blueprint_data === 'string' && layout.blueprint_data) {
      try { layout.blueprint_data = JSON.parse(layout.blueprint_data); } catch(e){ layout.blueprint_data = {}; }
    }
    res.json(layout);
  } catch (err) {
    console.error('GET /warehouse/layout error:', err);
    res.status(500).json({ error: 'Erro ao buscar layout' });
  }
});

// ── PUT /api/warehouse/layout — Update layout dimensions ──
router.put('/layout', async (req, res) => {
  try {
    const { room_w, room_h, door_x, door_y, door_w, aisles, blueprint_data } = req.body;
    let [active] = await pool.execute(
      'SELECT id FROM warehouse_layout WHERE is_active = 1 AND org_id = ? ORDER BY id ASC LIMIT 1',
      [req.user.org_id]
    );
    if (active.length === 0) {
      // Auto-create layout if missing
      const [ins] = await pool.execute(
        `INSERT INTO warehouse_layout (org_id, name, room_w, room_h, door_x, door_y, door_w, blueprint_data) VALUES (?, 'Armazém Principal', 720, 480, 620, 480, 100, '{}')`,
        [req.user.org_id]
      );
      active = [{ id: ins.insertId }];
    }

    await pool.execute(
      `UPDATE warehouse_layout SET room_w = ?, room_h = ?, door_x = ?, door_y = ?, door_w = ?, aisles = ?, blueprint_data = ?
       WHERE id = ?`,
      [
        room_w || 720, room_h || 480, door_x || 620, door_y || 480, door_w || 100,
        aisles ? JSON.stringify(aisles) : null,
        blueprint_data ? JSON.stringify(blueprint_data) : null,
        active[0].id
      ]
    );

    res.json({ message: 'Layout atualizado' });
  } catch (err) {
    console.error('PUT /warehouse/layout error:', err);
    res.status(500).json({ error: 'Erro ao atualizar layout' });
  }
});

// ── GET /api/warehouse/assignments — All assignments formatted for frontend ──
router.get('/assignments', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT s.shelf_code, sa.level, sa.position, m.code AS material_code
      FROM shelf_assignments sa
      JOIN shelves s ON sa.shelf_id = s.id
      JOIN materials m ON sa.material_id = m.id
      WHERE m.org_id = ?
    `, [req.user.org_id]);
    
    const formatted = {};
    for (const row of rows) {
      formatted[`${row.shelf_code}-N${row.level}-P${row.position}`] = row.material_code;
    }
    
    res.json(formatted);
  } catch (err) {
    console.error('GET /warehouse/assignments error:', err);
    res.status(500).json({ error: 'Erro ao buscar indexações do mapa' });
  }
});

// ── GET /api/warehouse/shelves — All shelves for active layout ──
router.get('/shelves', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT s.* FROM shelves s
      JOIN warehouse_layout wl ON s.layout_id = wl.id
      WHERE wl.is_active = 1 AND wl.org_id = ?
      ORDER BY s.shelf_code ASC
    `, [req.user.org_id]);
    res.json(rows);
  } catch (err) {
    console.error('GET /warehouse/shelves error:', err);
    res.status(500).json({ error: 'Erro ao buscar prateleiras' });
  }
});

// ── POST /api/warehouse/shelves — Create a new shelf ──
router.post('/shelves', async (req, res) => {
  try {
    const { shelf_code, pos_x, pos_y, width, height, levels, positions } = req.body;
    if (!shelf_code) {
      return res.status(400).json({ error: 'Código da prateleira obrigatório' });
    }

    const [active] = await pool.execute(
      'SELECT id FROM warehouse_layout WHERE is_active = 1 LIMIT 1'
    );
    if (active.length === 0) {
      return res.status(404).json({ error: 'Nenhum layout ativo' });
    }

    const [result] = await pool.execute(
      `INSERT INTO shelves (layout_id, shelf_code, pos_x, pos_y, width, height, levels, positions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [active[0].id, shelf_code, pos_x || 0, pos_y || 0, width || 120, height || 80, levels || 4, positions || 5]
    );

    const [created] = await pool.execute('SELECT * FROM shelves WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error('POST /warehouse/shelves error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Prateleira com este código já existe' });
    }
    res.status(500).json({ error: 'Erro ao criar prateleira' });
  }
});

// ── PUT /api/warehouse/shelves/:id — Update shelf position/size ──
router.put('/shelves/:id', async (req, res) => {
  try {
    const { pos_x, pos_y, width, height, levels, positions } = req.body;
    await pool.execute(
      `UPDATE shelves SET pos_x = ?, pos_y = ?, width = ?, height = ?, levels = ?, positions = ?
       WHERE id = ?`,
      [pos_x, pos_y, width, height, levels, positions, req.params.id]
    );
    res.json({ message: 'Prateleira atualizada' });
  } catch (err) {
    console.error('PUT /warehouse/shelves/:id error:', err);
    res.status(500).json({ error: 'Erro ao atualizar prateleira' });
  }
});

// ── DELETE /api/warehouse/shelves/:id ──
router.delete('/shelves/:id', async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM shelves WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Prateleira não encontrada' });
    }
    res.json({ message: 'Prateleira removida' });
  } catch (err) {
    console.error('DELETE /warehouse/shelves/:id error:', err);
    res.status(500).json({ error: 'Erro ao remover prateleira' });
  }
});

// ── GET /api/warehouse/shelves/:id/items — Items assigned to a shelf ──
router.get('/shelves/:id/items', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT sa.*, m.code, m.description, m.quantity, m.min_qty, m.brand
      FROM shelf_assignments sa
      JOIN materials m ON sa.material_id = m.id
      WHERE sa.shelf_id = ?
      ORDER BY sa.level ASC, sa.position ASC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('GET /warehouse/shelves/:id/items error:', err);
    res.status(500).json({ error: 'Erro ao buscar itens' });
  }
});

// ── POST /api/warehouse/assign — Assign material to shelf position ──
router.post('/assign', async (req, res) => {
  try {
    const { shelf_id, level, position, material_id } = req.body;
    if (!shelf_id || !level || !position || !material_id) {
      return res.status(400).json({ error: 'shelf_id, level, position e material_id são obrigatórios' });
    }

    const [result] = await pool.execute(
      `INSERT INTO shelf_assignments (shelf_id, level, position, material_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE material_id = VALUES(material_id)`,
      [shelf_id, level, position, material_id]
    );

    // Update material location
    const [shelf] = await pool.execute('SELECT shelf_code FROM shelves WHERE id = ?', [shelf_id]);
    if (shelf.length > 0) {
      const loc = `${shelf[0].shelf_code}${level}-N${level}-P${position}`;
      await pool.execute('UPDATE materials SET location = ? WHERE id = ?', [loc, material_id]);
    }

    res.status(201).json({ message: 'Material indexado no mapa', id: result.insertId });
  } catch (err) {
    console.error('POST /warehouse/assign error:', err);
    res.status(500).json({ error: 'Erro ao indexar material' });
  }
});

module.exports = router;
