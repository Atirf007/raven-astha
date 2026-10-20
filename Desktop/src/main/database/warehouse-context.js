'use strict';
// Additive upgrade; existing layouts/materials are preserved within their tenant.
async function upgrade(db){
 await db.query(`CREATE TABLE IF NOT EXISTS warehouse_map_meta (
  layout_id INT NOT NULL PRIMARY KEY, org_id VARCHAR(50) NOT NULL, cover_image MEDIUMTEXT NULL,
  archived_at DATETIME NULL, INDEX idx_map_meta_org (org_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await db.query(`CREATE TABLE IF NOT EXISTS movement_valuation (
  movement_id INT NOT NULL PRIMARY KEY, warehouse_id INT NULL, unit_price DECIMAL(18,4) NOT NULL,
  org_id VARCHAR(50) NOT NULL, INDEX idx_movement_valuation_org (org_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await db.query(`CREATE TABLE IF NOT EXISTS warehouse_context (
  warehouse_id INT NOT NULL PRIMARY KEY, org_id VARCHAR(50) NOT NULL,
  layout_id INT NOT NULL, org_unit_id INT NULL, parent_id INT NULL,
  INDEX idx_warehouse_context_org (org_id), INDEX idx_warehouse_context_layout (layout_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 const [warehouses]=await db.execute('SELECT id,org_id,name FROM warehouses ORDER BY org_id,tab_number,id');
 const used=new Set();
 for(const w of warehouses){
  const [context]=await db.execute('SELECT layout_id FROM warehouse_context WHERE warehouse_id=? AND org_id=?',[w.id,w.org_id]);
  if(context.length){used.add(w.org_id);continue;}
  const [layouts]=await db.execute('SELECT id FROM warehouse_layout WHERE org_id=? ORDER BY is_active DESC,id LIMIT 1',[w.org_id]);
  let layout=layouts[0]?.id;
  if(!layout||used.has(w.org_id)){
   const [created]=await db.execute("INSERT INTO warehouse_layout (org_id,name,room_w,room_h,door_x,door_y,door_w,blueprint_data) VALUES (?,?,720,480,620,480,100,'{}')",[w.org_id,w.name]);layout=created.insertId;
  }
  await db.execute('INSERT INTO warehouse_context (warehouse_id,org_id,layout_id) VALUES (?,?,?)',[w.id,w.org_id,layout]);used.add(w.org_id);
 }
 // Repair only absent/foreign legacy warehouse references, never an owned stock.
 for(const org of new Set(warehouses.map(w=>w.org_id))){
  const first=warehouses.find(w=>w.org_id===org);
  await db.execute(`UPDATE materials m LEFT JOIN warehouses w ON w.id=m.warehouse_id AND w.org_id=m.org_id
   SET m.warehouse_id=? WHERE m.org_id=? AND w.id IS NULL`,[first.id,org]);
 }
}
module.exports={upgrade};
