'use strict';
const {id,failure}=require('./warehouse-context');
function filters(query){
 const to=query.to||new Date().toISOString().slice(0,10),from=query.from||new Date(Date.now()-29*86400000).toISOString().slice(0,10);
 for(const value of [from,to])if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw failure('Período inválido.');
 const days=(Date.parse(to)-Date.parse(from))/86400000;if(days<0||days>365)throw failure('Selecione um período de até 366 dias.');
 const ids=query.warehouses?String(query.warehouses).split(',').map(id):[];
 if(ids.length>100||new Set(ids).size!==ids.length)throw failure('Seleção de estoques inválida.');
 return {from,to,ids};
}
async function insights(db,org,query){
 const {from,to,ids}=filters(query);
 const [stocks]=await db.execute(`SELECT w.id,w.name,c.layout_id,u.name AS branch_name,meta.cover_image FROM warehouses w
  JOIN warehouse_context c ON c.warehouse_id=w.id AND BINARY c.org_id=BINARY w.org_id
  LEFT JOIN warehouse_map_meta meta ON meta.layout_id=c.layout_id AND BINARY meta.org_id=BINARY w.org_id
  LEFT JOIN org_units u ON u.id=c.org_unit_id AND BINARY u.org_id=BINARY w.org_id
  WHERE w.org_id=? AND meta.archived_at IS NULL ORDER BY w.tab_number,w.id`,[org]);
 const selected=ids.length?ids:stocks.map(s=>s.id);if(selected.some(value=>!stocks.some(s=>s.id===value)))throw failure('Estoque não encontrado nesta organização.',404);
 if(!selected.length)return {stocks,selected,from,to,summary:{},series:[],inventory:[],recent:[],registrations:[],attribution:[],valuation:'Sem movimentações'};
 const placeholders=selected.map(()=>'?').join(',');
 const materialScope=`mat.org_id=? AND mat.is_active=1 AND mat.warehouse_id IN (${placeholders})`;
 const movementScope=`mat.org_id=? AND COALESCE(v.warehouse_id,mat.warehouse_id) IN (${placeholders}) AND m.created_at>=? AND m.created_at<DATE_ADD(?,INTERVAL 1 DAY)`;
 const movementParams=[org,...selected,from,to];
 const results=await Promise.all([
  db.execute(`SELECT COUNT(*) AS materials,COALESCE(SUM(mat.quantity),0) AS quantity,COALESCE(SUM(mat.quantity*mat.unit_price),0) AS stock_value,
   SUM(mat.quantity<=mat.min_qty) AS critical,SUM(mat.quantity=0) AS zero,SUM(mat.location IS NOT NULL AND mat.location<>'' AND mat.location<>'N/A') AS located FROM materials mat WHERE ${materialScope}`,[org,...selected]),
  db.execute(`SELECT DATE_FORMAT(m.created_at,'%Y-%m-%d') AS day,m.type,SUM(m.quantity) AS quantity,SUM(m.quantity*COALESCE(v.unit_price,mat.unit_price)) AS value,COUNT(*) AS operations,SUM(v.movement_id IS NULL) AS estimated
   FROM movements m JOIN materials mat ON mat.id=m.material_id LEFT JOIN movement_valuation v ON v.movement_id=m.id WHERE ${movementScope} GROUP BY day,m.type ORDER BY day`,movementParams),
  db.execute(`SELECT mat.warehouse_id,w.name,COUNT(*) AS materials,SUM(mat.quantity) AS quantity,SUM(mat.quantity*mat.unit_price) AS stock_value,SUM(mat.quantity<=mat.min_qty) AS critical,SUM(mat.location IS NOT NULL AND mat.location<>'' AND mat.location<>'N/A') AS located
   FROM materials mat JOIN warehouses w ON w.id=mat.warehouse_id WHERE ${materialScope} GROUP BY mat.warehouse_id,w.name`,[org,...selected]),
  db.execute(`SELECT DATE_FORMAT(mat.created_at,'%Y-%m-%d') AS day,COUNT(*) AS count FROM materials mat WHERE ${materialScope} AND mat.created_at>=? AND mat.created_at<DATE_ADD(?,INTERVAL 1 DAY) GROUP BY day ORDER BY day`,[org,...selected,from,to]),
  db.execute(`SELECT m.type,m.quantity,m.created_at,m.responsible,m.reason,m.notes,mat.code AS material_code,mat.description AS material_desc,w.name AS warehouse_name
   FROM movements m JOIN materials mat ON mat.id=m.material_id LEFT JOIN movement_valuation v ON v.movement_id=m.id JOIN warehouses w ON w.id=COALESCE(v.warehouse_id,mat.warehouse_id)
   WHERE ${movementScope} ORDER BY m.created_at DESC,m.id DESC LIMIT 20`,movementParams),
  db.execute(`SELECT COALESCE(NULLIF(m.reason,''),'Sem finalidade informada') AS reason,COUNT(*) AS operations,SUM(m.quantity) AS quantity FROM movements m JOIN materials mat ON mat.id=m.material_id LEFT JOIN movement_valuation v ON v.movement_id=m.id
   WHERE ${movementScope} AND m.type='saida' GROUP BY reason ORDER BY quantity DESC LIMIT 12`,movementParams),
  db.execute(`SELECT mat.code,mat.description,mat.quantity,mat.min_qty,mat.location FROM materials mat WHERE ${materialScope} AND mat.quantity<=mat.min_qty ORDER BY mat.quantity,mat.code LIMIT 100`,[org,...selected])
 ]);
 return {stocks,selected,from,to,summary:results[0][0][0],series:results[1][0],inventory:stocks.filter(s=>selected.includes(s.id)).map(stock=>results[2][0].find(r=>r.warehouse_id===stock.id)||{warehouse_id:stock.id,name:stock.name,materials:0,quantity:0,stock_value:0,critical:0,located:0}),registrations:results[3][0],recent:results[4][0],attribution:results[5][0],critical_items:results[6][0],valuation:!results[1][0].length?'Nenhuma movimentação no período.':results[1][0].some(r=>Number(r.estimated)>0)?'Parte do histórico usa estimativas pelo preço atual; novas movimentações preservam o preço registrado.':'Valores registrados no momento da movimentação.',updated_at:new Date().toISOString()};
}
module.exports={filters,insights};
