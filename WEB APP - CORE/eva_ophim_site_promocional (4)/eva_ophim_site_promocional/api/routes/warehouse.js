/* ============================================================
   Warehouse Routes — /api/warehouse (MySQL-backed)
   Layout, shelves, and shelf assignment management
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const authMiddleware = require('../middleware/auth');
const { validateBlueprint, boundedNumber } = require('../security/blueprint');

const router = express.Router();
router.use(authMiddleware);
router.use((req, res, next) => {
  if (!req.user.org_id) return res.status(403).json({ error: 'Organização obrigatória' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !['superadmin', 'admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permissão insuficiente' });
  }
  next();
});

// The map hub is stored by tenant on the server. Old browser-wide localStorage data
// is deliberately never imported: its owner cannot be established safely.
router.get('/map-hub', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT maps_json FROM org_map_hub WHERE org_id = ?', [req.user.org_id]);
    res.json({ maps: rows.length ? JSON.parse(rows[0].maps_json) : [] });
  } catch (err) {
    console.error('GET /warehouse/map-hub:', err.code || err.name);
    res.status(500).json({ error: 'Não foi possível carregar os mapas' });
  }
});

router.put('/map-hub', async (req, res) => {
  const maps = req.body?.maps;
  if (!Array.isArray(maps) || maps.length > 50) return res.status(400).json({ error: 'Lista de mapas inválida' });
  const validText = (value, max) => typeof value === 'string' && value.length <= max;
  const validPoint = value => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
  for (const map of maps) {
    if (!map || !validText(map.id, 100) || !validText(map.name, 160) || !['corp', 'stock'].includes(map.type)
      || !Array.isArray(map.sectors) || map.sectors.length > 300 || !Array.isArray(map.items) || map.items.length > 1000
      || (map.imageUrl != null && (!validText(map.imageUrl, 2_000_000) || !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(map.imageUrl)))) {
      return res.status(400).json({ error: 'Dados do mapa inválidos' });
    }
    if (map.sectors.some(s => !s || !validText(s.id, 100) || !validText(s.name, 160) || !validPoint(s.x) || !validPoint(s.y) || !validPoint(s.w) || !validPoint(s.h))
      || map.items.some(i => !i || !validText(i.id, 100) || !validText(i.material, 200) || !validPoint(i.x) || !validPoint(i.y))) {
      return res.status(400).json({ error: 'Elementos do mapa inválidos' });
    }
  }
  const payload = JSON.stringify(maps);
  if (Buffer.byteLength(payload, 'utf8') > 4_000_000) return res.status(413).json({ error: 'Mapas excedem o limite de armazenamento' });
  try {
    await pool.execute(`INSERT INTO org_map_hub (org_id, maps_json) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE maps_json = VALUES(maps_json)`, [req.user.org_id, payload]);
    res.json({ saved: true });
  } catch (err) {
    console.error('PUT /warehouse/map-hub:', err.code || err.name);
    res.status(500).json({ error: 'Não foi possível salvar os mapas' });
  }
});

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
    let [rows] = await pool.execute(
      'SELECT * FROM warehouse_layout WHERE is_active = 1 AND org_id = ? LIMIT 1',
      [req.user.org_id]
    );
    if (!rows.length) {
      // Reading an unconfigured organization must not provision or expose another tenant.
      return res.json({ room_w: 720, room_h: 480, door_x: 620, door_y: 480, door_w: 100, aisles: [], blueprint_data: {} });
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
    let safeBlueprint = null;
    try {
      safeBlueprint = blueprint_data === undefined ? null : validateBlueprint(blueprint_data);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    let dimensions;
    try {
      dimensions = {
        room_w: boundedNumber(room_w, null, 10, 100000), room_h: boundedNumber(room_h, null, 10, 100000),
        door_x: boundedNumber(door_x, null, -100000, 100000), door_y: boundedNumber(door_y, null, -100000, 100000),
        door_w: boundedNumber(door_w, null, 1, 10000)
      };
    } catch (validationError) { return res.status(400).json({ error: validationError.message }); }
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
      `UPDATE warehouse_layout SET room_w = COALESCE(?, room_w), room_h = COALESCE(?, room_h),
       door_x = COALESCE(?, door_x), door_y = COALESCE(?, door_y), door_w = COALESCE(?, door_w),
       aisles = COALESCE(?, aisles), blueprint_data = COALESCE(?, blueprint_data)
       WHERE id = ? AND org_id = ?`,
      [
        dimensions.room_w, dimensions.room_h, dimensions.door_x, dimensions.door_y, dimensions.door_w,
        aisles === undefined ? null : JSON.stringify(aisles),
        safeBlueprint ? JSON.stringify(safeBlueprint) : null,
        active[0].id, req.user.org_id
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
      JOIN warehouse_layout wl ON s.layout_id = wl.id
      JOIN materials m ON sa.material_id = m.id
      WHERE m.org_id = ? AND wl.org_id = m.org_id
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
      'SELECT id FROM warehouse_layout WHERE is_active = 1 AND org_id = ? LIMIT 1', [req.user.org_id]
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
    const [result] = await pool.execute(
      `UPDATE shelves s JOIN warehouse_layout wl ON s.layout_id = wl.id SET pos_x = ?, pos_y = ?, width = ?, height = ?, levels = ?, positions = ?
       WHERE s.id = ? AND wl.org_id = ?`,
      [pos_x, pos_y, width, height, levels, positions, req.params.id, req.user.org_id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Prateleira não encontrada' });
    res.json({ message: 'Prateleira atualizada' });
  } catch (err) {
    console.error('PUT /warehouse/shelves/:id error:', err);
    res.status(500).json({ error: 'Erro ao atualizar prateleira' });
  }
});

// ── DELETE /api/warehouse/shelves/:id ──
router.delete('/shelves/:id', async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE s FROM shelves s JOIN warehouse_layout wl ON s.layout_id = wl.id WHERE s.id = ? AND wl.org_id = ?', [req.params.id, req.user.org_id]);
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
      JOIN shelves s ON sa.shelf_id = s.id
      JOIN warehouse_layout wl ON s.layout_id = wl.id
      WHERE sa.shelf_id = ? AND wl.org_id = ? AND m.org_id = wl.org_id
      ORDER BY sa.level ASC, sa.position ASC
    `, [req.params.id, req.user.org_id]);
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

    if (![shelf_id, level, position, material_id].every(v => Number.isSafeInteger(Number(v)) && Number(v) > 0)) {
      return res.status(400).json({ error: 'Posição inválida' });
    }
    const connection = await pool.getConnection();
    let result;
    try {
      await connection.beginTransaction();
      const [shelves] = await connection.execute(
        `SELECT s.shelf_code, s.levels, s.positions FROM shelves s JOIN warehouse_layout wl ON s.layout_id = wl.id
         WHERE s.id = ? AND wl.org_id = ? FOR UPDATE`, [shelf_id, req.user.org_id]);
      const [materials] = await connection.execute('SELECT id FROM materials WHERE id = ? AND org_id = ? FOR UPDATE', [material_id, req.user.org_id]);
      if (!shelves.length || !materials.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Prateleira ou material não encontrado' });
      }
      if (Number(level) > shelves[0].levels || Number(position) > shelves[0].positions) {
        await connection.rollback();
        return res.status(400).json({ error: 'Posição inválida' });
      }
      [result] = await connection.execute(
        `INSERT INTO shelf_assignments (shelf_id, level, position, material_id) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE material_id = VALUES(material_id)`, [shelf_id, level, position, material_id]);
      const loc = `${shelves[0].shelf_code}${level}-N${level}-P${position}`;
      await connection.execute('UPDATE materials SET location = ? WHERE id = ? AND org_id = ?', [loc, material_id, req.user.org_id]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally { connection.release(); }

    res.status(201).json({ message: 'Material indexado no mapa', id: result.insertId });
  } catch (err) {
    console.error('POST /warehouse/assign error:', err);
    res.status(500).json({ error: 'Erro ao indexar material' });
  }
});

module.exports = router;
