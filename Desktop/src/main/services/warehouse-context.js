'use strict';
function failure(message,status=400){return Object.assign(new Error(message),{status});}
function id(value){if(!/^[1-9]\d*$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw failure('Selecione um armazém válido.');return Number(value);}
async function warehouse(db,org,value){
 const [rows]=await db.execute(`SELECT w.id,w.name,c.layout_id,c.org_unit_id,c.parent_id FROM warehouses w
  JOIN warehouse_context c ON c.warehouse_id=w.id AND BINARY c.org_id=BINARY w.org_id LEFT JOIN warehouse_map_meta meta ON meta.layout_id=c.layout_id AND BINARY meta.org_id=BINARY w.org_id WHERE w.id=? AND w.org_id=? AND meta.archived_at IS NULL`,[id(value),org]);
 if(!rows.length)throw failure('Armazém não encontrado nesta organização.',404);return rows[0];
}
async function layoutId(db,org,value){
 if(value!==undefined&&value!==null&&value!=='')return (await warehouse(db,org,value)).layout_id;
 const [rows]=await db.execute(`SELECT c.layout_id FROM warehouses w JOIN warehouse_context c ON c.warehouse_id=w.id AND BINARY c.org_id=BINARY w.org_id
  LEFT JOIN warehouse_map_meta meta ON meta.layout_id=c.layout_id AND BINARY meta.org_id=BINARY w.org_id WHERE w.org_id=? AND meta.archived_at IS NULL ORDER BY w.tab_number,w.id LIMIT 1`,[org]);
 if(!rows.length)throw failure('Cadastre um armazém ou estoque para começar.',409);return rows[0].layout_id;
}
function shelves(blueprint,stock,defaultStock){
 const rows=[];for(const [floor,value] of Object.entries(blueprint?.floors||{}))for(const shelf of value.shelves||[]){
  if(shelf.visible===false||Number(shelf.warehouse_id||defaultStock)!==Number(stock))continue;
  rows.push({code:shelf.id,floor:Number(floor),levels:Number(shelf.levels)||3,positions:Number(shelf.positions)||4});
 }return rows;
}
async function positions(db,org,stock){
 const context=await warehouse(db,org,stock);
 const [rows]=await db.execute('SELECT blueprint_data FROM warehouse_layout WHERE id=? AND org_id=?',[context.layout_id,org]);
 const raw=rows[0]?.blueprint_data;const blueprint=typeof raw==='string'?JSON.parse(raw||'{}'):raw||{};
 const [primary]=await db.execute('SELECT warehouse_id FROM warehouse_context WHERE layout_id=? AND org_id=? ORDER BY warehouse_id LIMIT 1',[context.layout_id,org]);
 return shelves(blueprint,stock,primary[0]?.warehouse_id||context.id);
}
async function validatePosition(db,org,stock,location){
 await warehouse(db,org,stock);
 if(!location||location==='N/A')return null;
 if(typeof location!=='string'||location.length>150)throw failure('Posição inválida.');
 const available=await positions(db,org,stock);
 const match=available.some(s=>{for(let level=1;level<=s.levels;level++)for(let position=1;position<=s.positions;position++)if(location===`${s.code}-N${level}-P${position}`)return true;return false;});
 if(!match)throw failure('Escolha uma posição disponível no mapa deste estoque.');return location;
}
module.exports={warehouse,layoutId,positions,validatePosition,id,failure};
