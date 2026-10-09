/* ============================================================
   Warehouse Routes — /api/warehouse (MySQL-backed)
   Layout, shelves, and shelf assignment management
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const authMiddleware = require('../middleware/auth');
const { validateBlueprint, boundedNumber } = require('../security/blueprint');
const stockContext = require('../services/warehouse-context');

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
router.get('/insights',async(req,res)=>{try{res.json(await require('../services/stock-insights').insights(pool,req.user.org_id,req.query));}catch(error){res.status(error.status||500).json({error:error.status?error.message:'Não foi possível carregar os indicadores.'});}});
router.get('/archived-maps',async(req,res)=>{
 try{const [rows]=await pool.execute('SELECT l.id,l.name,meta.archived_at FROM warehouse_layout l JOIN warehouse_map_meta meta ON meta.layout_id=l.id WHERE l.org_id=? AND meta.org_id=? AND meta.archived_at IS NOT NULL',[req.user.org_id,req.user.org_id]);res.json(rows);}catch(_){res.status(500).json({error:'Não foi possível carregar a lixeira.'});}
});
router.delete('/maps/:id',async(req,res)=>{
 try{const layout=stockContext.id(req.params.id);const [owned]=await pool.execute('SELECT id FROM warehouse_layout WHERE id=? AND org_id=?',[layout,req.user.org_id]);if(!owned.length)throw stockContext.failure('Mapa não encontrado.',404);
  await pool.execute('INSERT INTO warehouse_map_meta (layout_id,org_id,archived_at) VALUES (?,?,NOW()) ON DUPLICATE KEY UPDATE archived_at=NOW()',[layout,req.user.org_id]);res.json({success:true});
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Não foi possível excluir o mapa.'});}
});
router.post('/maps/:id/restore',async(req,res)=>{
 try{const [result]=await pool.execute('UPDATE warehouse_map_meta SET archived_at=NULL WHERE layout_id=? AND org_id=?',[stockContext.id(req.params.id),req.user.org_id]);if(!result.affectedRows)throw stockContext.failure('Mapa não encontrado.',404);res.json({success:true});}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Não foi possível restaurar o mapa.'});}
});
router.put('/maps/:id/cover',async(req,res)=>{
 try{const layout=stockContext.id(req.params.id);let cover;try{cover=require('../security/organization-profile').validateProfile({cover_image:req.body.cover_image||null,links:[]}).cover_image;}catch(_){throw stockContext.failure('Use uma imagem PNG, JPG ou WebP válida.');}
  const [owned]=await pool.execute('SELECT id FROM warehouse_layout WHERE id=? AND org_id=?',[layout,req.user.org_id]);if(!owned.length)throw stockContext.failure('Mapa não encontrado.',404);
  await pool.execute('INSERT INTO warehouse_map_meta (layout_id,org_id,cover_image) VALUES (?,?,?) ON DUPLICATE KEY UPDATE cover_image=VALUES(cover_image)',[layout,req.user.org_id,cover]);res.json({success:true});
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Não foi possível salvar a imagem.'});}
});
router.get('/map-hub', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT maps_json FROM org_map_hub WHERE org_id = ?', [req.user.org_id]);
    const maps = rows.length ? JSON.parse(rows[0].maps_json) : [];
    const [stocks] = await pool.execute(`SELECT w.id,w.name,c.layout_id,l.name AS map_name,u.name AS branch_name,meta.cover_image
      FROM warehouses w JOIN warehouse_context c ON c.warehouse_id=w.id AND BINARY c.org_id=BINARY w.org_id
      JOIN warehouse_layout l ON l.id=c.layout_id AND BINARY l.org_id=BINARY w.org_id
      LEFT JOIN warehouse_map_meta meta ON meta.layout_id=c.layout_id AND BINARY meta.org_id=BINARY w.org_id
      LEFT JOIN org_units u ON u.id=c.org_unit_id AND BINARY u.org_id=BINARY w.org_id
      WHERE w.org_id=? AND meta.archived_at IS NULL ORDER BY w.tab_number,w.id`, [req.user.org_id]);
    const layouts = new Map();
    for (const stock of stocks) {
      if (!layouts.has(stock.layout_id)) layouts.set(stock.layout_id, {
        id:'cad-'+stock.layout_id, source:'cad', type:'stock', name:stock.map_name,
        layout_id:stock.layout_id, warehouse_id:stock.id, warehouse_ids:[],
        branch_name:stock.branch_name || 'Sede', cover_image:stock.cover_image, sectors:[], items:[]
      });
      layouts.get(stock.layout_id).warehouse_ids.push(stock.id);
    }
    const [located]=await pool.execute(`SELECT m.code,m.description,m.location,m.quantity,m.warehouse_id,c.layout_id
      FROM materials m JOIN warehouse_context c ON c.warehouse_id=m.warehouse_id
      WHERE m.org_id=? AND c.org_id=? AND m.is_active=1 AND m.location IS NOT NULL`,[req.user.org_id,req.user.org_id]);
    for(const material of located){
      const slot=String(material.location).match(/^(.*)-N(\d+)-P(\d+)$/);
      const map=layouts.get(material.layout_id);
      if(map&&slot)map.items.push({id:material.code,material:material.description,code:material.code,
        location:slot[1],slot:material.location,level:Number(slot[2])-1,position:Number(slot[3])-1,
        warehouse_id:material.warehouse_id,quantity:Number(material.quantity),color:'#334155'});
    }
    res.json({ maps:[...maps.filter(map=>map.source!=='cad'), ...layouts.values()] });
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
    if(map?.source==='cad'||String(map?.id||'').startsWith('cad-'))return res.status(400).json({error:'Plantas CAD são salvas pelo editor do armazém.'});
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
      `SELECT w.id,w.name,w.tab_number,w.is_shared,c.layout_id,c.parent_id,c.org_unit_id,
       u.name AS branch_name,l.name AS map_name,meta.cover_image FROM warehouses w
       JOIN warehouse_context c ON c.warehouse_id=w.id AND BINARY c.org_id=BINARY w.org_id
       JOIN warehouse_layout l ON l.id=c.layout_id AND BINARY l.org_id=BINARY w.org_id
       LEFT JOIN warehouse_map_meta meta ON meta.layout_id=c.layout_id AND BINARY meta.org_id=BINARY w.org_id
      LEFT JOIN org_units u ON u.id=c.org_unit_id AND BINARY u.org_id=BINARY w.org_id
       WHERE w.org_id = ? AND meta.archived_at IS NULL ORDER BY w.tab_number,w.id`,
      [req.user.org_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /warehouse/tabs error:', err);
    res.status(500).json({ error: 'Erro ao buscar abas de armazém' });
  }
});

router.get('/branches',async(req,res)=>{
 try{const [rows]=await pool.execute("SELECT id,code,name FROM org_units WHERE org_id=? AND unit_type='branch' AND status='active' ORDER BY name",[req.user.org_id]);res.json(rows);}
 catch(_){res.status(500).json({error:'Não foi possível carregar as filiais.'});}
});
router.post('/tabs',async(req,res)=>{
 let db;try{
  const name=typeof req.body.name==='string'?req.body.name.trim():'';
  if(!name||name.length>100)throw stockContext.failure('Informe um nome de até 100 caracteres.');
  let cover;try{cover=require('../security/organization-profile').validateProfile({cover_image:req.body.cover_image||null,links:[]}).cover_image;}catch(_){throw stockContext.failure('Use uma imagem PNG, JPG ou WebP válida.');}
  db=await pool.getConnection();await db.beginTransaction();
  await db.execute('SELECT id FROM organizations WHERE id=? FOR UPDATE',[req.user.org_id]);
  let branch=req.body.org_unit_id?stockContext.id(req.body.org_unit_id):null;
  let parent=null,layout=null;
  if(req.body.parent_id){parent=await stockContext.warehouse(db,req.user.org_id,req.body.parent_id);layout=parent.layout_id;branch=parent.org_unit_id;}
  else if(req.body.layout_id){
   const [owned]=await db.execute('SELECT c.layout_id,c.org_unit_id FROM warehouse_context c WHERE c.layout_id=? AND c.org_id=? ORDER BY c.warehouse_id LIMIT 1',[stockContext.id(req.body.layout_id),req.user.org_id]);
   if(!owned.length)throw stockContext.failure('Mapa não encontrado nesta organização.',404);layout=owned[0].layout_id;branch=owned[0].org_unit_id;
  }
  if(branch){const [unit]=await db.execute("SELECT id FROM org_units WHERE id=? AND org_id=? AND unit_type='branch' AND status='active'",[branch,req.user.org_id]);if(!unit.length)throw stockContext.failure('Filial não encontrada nesta organização.',404);}
  if(!layout){const [created]=await db.execute("INSERT INTO warehouse_layout (org_id,name,room_w,room_h,door_x,door_y,door_w,blueprint_data) VALUES (?,?,720,480,620,480,100,'{}')",[req.user.org_id,name]);layout=created.insertId;}
  const [number]=await db.execute('SELECT COALESCE(MAX(tab_number),0)+1 AS next_number FROM warehouses WHERE org_id=?',[req.user.org_id]);
  const [created]=await db.execute('INSERT INTO warehouses (org_id,name,tab_number) VALUES (?,?,?)',[req.user.org_id,name,number[0].next_number]);
  await db.execute('INSERT INTO warehouse_context (warehouse_id,org_id,layout_id,org_unit_id,parent_id) VALUES (?,?,?,?,?)',[created.insertId,req.user.org_id,layout,branch,parent?.id||null]);
  if(cover)await db.execute('INSERT INTO warehouse_map_meta (layout_id,org_id,cover_image) VALUES (?,?,?) ON DUPLICATE KEY UPDATE cover_image=VALUES(cover_image)',[layout,req.user.org_id,cover]);
  await db.commit();res.status(201).json({id:created.insertId,name,layout_id:layout,org_unit_id:branch,parent_id:parent?.id||null});
 }catch(error){if(db)await db.rollback();res.status(error.status||500).json({error:error.status?error.message:'Não foi possível criar o armazém.'});}finally{db?.release();}
});
router.get('/positions',async(req,res)=>{
 try{res.json(await stockContext.positions(pool,req.user.org_id,req.query.warehouse_id));}
 catch(error){res.status(error.status||500).json({error:error.status?error.message:'Não foi possível carregar as prateleiras.'});}
});

router.use(require('./industrial-map')(pool));

// ── GET /api/warehouse/layout — Active warehouse layout ──
router.get('/layout', async (req, res) => {
  try {
    const layoutId=await stockContext.layoutId(pool,req.user.org_id,req.query.warehouse_id);
    let [rows] = await pool.execute('SELECT * FROM warehouse_layout WHERE id=? AND org_id=?',[layoutId,req.user.org_id]);
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
    layout.industrialSchemaVersion=1;
    try{layout.revision=await require('../services/industrial-map').revision(pool,req.user.org_id,layout.id);layout.industrialSchemaReady=true;}catch(error){if(!['ER_NO_SUCH_TABLE','ER_TABLEACCESS_DENIED_ERROR'].includes(error.code))throw error;layout.revision=0;layout.industrialSchemaReady=false;}
    res.json(layout);
  } catch (err) {
    console.error('GET /warehouse/layout error:', err);
    res.status(err.status||500).json({ error: err.status?err.message:'Erro ao buscar layout' });
  }
});

// ── PUT /api/warehouse/layout — Update layout dimensions ──
router.put('/layout',async(req,res)=>{try{res.json(await require('../services/industrial-map').publish(pool,req.user,req.body));}catch(error){const missing=['ER_NO_SUCH_TABLE','ER_TABLEACCESS_DENIED_ERROR'].includes(error.code);res.status(missing?503:error.status||500).json({error:missing?'Aplique a migração industrial e as permissões das novas tabelas no MySQL.':error.status?error.message:'Não foi possível publicar o mapa.'});}});

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
    const layout=await stockContext.layoutId(pool,req.user.org_id,req.query.warehouse_id);
    const [rows] = await pool.execute(`
      SELECT s.* FROM shelves s
      JOIN warehouse_layout wl ON s.layout_id = wl.id
      WHERE wl.id=? AND wl.org_id = ?
      ORDER BY s.shelf_code ASC
    `, [layout,req.user.org_id]);
    res.json(rows);
  } catch (err) {
    console.error('GET /warehouse/shelves error:', err);
    res.status(err.status||500).json({ error:err.status?err.message:'Erro ao buscar prateleiras' });
  }
});

// ── POST /api/warehouse/shelves — Create a new shelf ──
router.post('/shelves', async (req, res) => {
  try {
    const { shelf_code, pos_x, pos_y, width, height, levels, positions } = req.body;
    if (!shelf_code) {
      return res.status(400).json({ error: 'Código da prateleira obrigatório' });
    }

    const selectedLayout=await stockContext.layoutId(pool,req.user.org_id,req.body.warehouse_id);
    const [active] = await pool.execute(
      'SELECT id FROM warehouse_layout WHERE id=? AND org_id=?', [selectedLayout,req.user.org_id]
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
        `SELECT s.shelf_code, s.layout_id, s.levels, s.positions FROM shelves s JOIN warehouse_layout wl ON s.layout_id = wl.id
         WHERE s.id = ? AND wl.org_id = ? FOR UPDATE`, [shelf_id, req.user.org_id]);
      const [materials] = await connection.execute('SELECT id,warehouse_id FROM materials WHERE id = ? AND org_id = ? FOR UPDATE', [material_id, req.user.org_id]);
      if (!shelves.length || !materials.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Prateleira ou material não encontrado' });
      }
      if (Number(level) > shelves[0].levels || Number(position) > shelves[0].positions) {
        await connection.rollback();
        return res.status(400).json({ error: 'Posição inválida' });
      }
      const stock=await stockContext.warehouse(connection,req.user.org_id,materials[0].warehouse_id);
      if(stock.layout_id!==shelves[0].layout_id)throw stockContext.failure('A prateleira não pertence ao mapa deste estoque.');
      const loc = `${shelves[0].shelf_code}-N${level}-P${position}`;
      await stockContext.validatePosition(connection,req.user.org_id,stock.id,loc);
      [result] = await connection.execute(
        `INSERT INTO shelf_assignments (shelf_id, level, position, material_id) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE material_id = VALUES(material_id)`, [shelf_id, level, position, material_id]);
      await connection.execute('UPDATE materials SET location = ? WHERE id = ? AND org_id = ?', [loc, material_id, req.user.org_id]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally { connection.release(); }

    res.status(201).json({ message: 'Material indexado no mapa', id: result.insertId });
  } catch (err) {
    console.error('POST /warehouse/assign error:', err);
    res.status(err.status||500).json({ error:err.status?err.message:'Erro ao indexar material' });
  }
});

module.exports = router;
