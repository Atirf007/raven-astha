'use strict';
const {createHash}=require('node:crypto');
const {Worker}=require('node:worker_threads');
const path=require('node:path');
const {validateBlueprint,boundedNumber}=require('../security/blueprint');
const context=require('./warehouse-context');
const {MAX_BYTES}=require('../../renderer/js/sistema-model-import-validator');
const failure=context.failure;
const parse=value=>typeof value==='string'?JSON.parse(value||'{}'):value||{};
const integer=value=>Number.isSafeInteger(value)&&value>=0;
function stampAudit(blueprint,previous,user,now=new Date().toISOString()){
 const key=(level,collection,item)=>(item.modelId||collection==='shelves'?'':level+':')+collection+':'+item.id;const old=new Map();for(const [level,floor] of Object.entries(previous?.floors||{}))for(const [collection,items] of Object.entries(floor))if(Array.isArray(items))for(const item of items)old.set(key(level,collection,item),item);
 for(const [level,floor] of Object.entries(blueprint.floors))for(const [collection,items] of Object.entries(floor))for(const item of items){const original=old.get(key(level,collection,item)),prior=original?.audit;const clean=record=>{const value={...record};delete value.audit;return JSON.stringify(value);};const changed=!original||clean(original)!==clean(item);item.audit={createdBy:prior?.createdBy||user.id,createdAt:prior?.createdAt||now,updatedBy:changed?user.id:prior?.updatedBy||user.id,updatedAt:changed?now:prior?.updatedAt||now};}
 return blueprint;
}
async function revision(db,org,layout){const [rows]=await db.execute('SELECT revision_number AS revision FROM warehouse_map_revisions WHERE org_id=? AND layout_id=? ORDER BY revision_number DESC LIMIT 1',[org,layout]);return Number(rows[0]?.revision)||0;}
// Read the latest committed revision after acquiring the layout lock. Immutable
// revision rows need only SELECT/INSERT privileges; never lock them for updates.
async function beginMapTransaction(db){await db.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await db.beginTransaction();}
async function references(db,org,layout,blueprint,user){
 const entities=Object.values(blueprint.floors).flatMap(floor=>Object.values(floor).flat());
 const assetIds=[...new Set(entities.map(e=>e.linkedAssetId).filter(id=>id!=null))],importIds=[...new Set(entities.map(e=>e.importId).filter(id=>id!=null))];
 if(assetIds.some(id=>!Number.isSafeInteger(id)||id<1)||importIds.some(id=>!Number.isSafeInteger(id)||id<1))throw failure('Referência de ativo ou modelo inválida.');
 if(assetIds.length&&user&&!['admin','superadmin'].includes(user.role)){const [groups]=await db.execute('SELECT g.permissions FROM org_access_groups g JOIN org_access_group_members m ON m.group_id=g.id AND m.org_id=g.org_id WHERE m.org_id=? AND m.user_id=?',[org,user.id]);if(groups.length&&!groups.some(g=>parse(g.permissions)?.eam?.read))throw failure('Seu grupo não permite vincular ativos EAM.',403);}
 if(assetIds.length){const [owned]=await db.query('SELECT id FROM assets WHERE org_id=? AND id IN (?)',[org,assetIds]);if(owned.length!==assetIds.length)throw failure('Ativo não encontrado nesta organização.',404);}
 if(importIds.length){const [owned]=await db.query('SELECT id,triangles FROM warehouse_model_imports WHERE org_id=? AND layout_id=? AND id IN (?)',[org,layout,importIds]);if(owned.length!==importIds.length)throw failure('Modelo não encontrado neste mapa.',404);const triangles=new Map(owned.map(row=>[row.id,Number(row.triangles)]));let total=0;for(const entity of entities)if(entity.importId){entity.importTriangles=triangles.get(entity.importId);total+=entity.importTriangles;}if(total>500000)throw failure('Modelos importados excedem 500.000 triângulos no mapa.',413);}
 const [stocks]=await db.execute('SELECT warehouse_id FROM warehouse_context WHERE layout_id=? AND org_id=?',[layout,org]);const allowed=new Set(stocks.map(row=>Number(row.warehouse_id)));
 if(entities.some(e=>e.type==='shelf'&&e.warehouse_id&&!allowed.has(Number(e.warehouse_id))))throw failure('A prateleira deve pertencer a um estoque deste mapa.');
}
async function publish(pool,user,body){
 let blueprint;try{blueprint=body.blueprint_data===undefined?null:validateBlueprint(body.blueprint_data);}catch(error){throw failure(error.message);}
 const dimensions={};for(const [key,min,max] of [['room_w',10,100000],['room_h',10,100000],['door_x',-100000,100000],['door_y',-100000,100000],['door_w',1,10000]])try{dimensions[key]=boundedNumber(body[key],null,min,max);}catch(e){throw failure(e.message);}
 if(body.aisles!==undefined&&(!Array.isArray(body.aisles)||body.aisles.length>300||Buffer.byteLength(JSON.stringify(body.aisles))>100000))throw failure('Corredores inválidos.');
 if(body.expected_revision!==undefined&&!integer(body.expected_revision))throw failure('Revisão inválida.');
 const db=await pool.getConnection();try{await beginMapTransaction(db);const layout=await context.layoutId(db,user.org_id,body.warehouse_id);
 const [rows]=await db.execute('SELECT id,blueprint_data FROM warehouse_layout WHERE id=? AND org_id=? FOR UPDATE',[layout,user.org_id]);if(!rows.length)throw failure('Mapa não encontrado.',404);
 const current=await revision(db,user.org_id,layout);if(body.expected_revision!==undefined&&body.expected_revision!==current)throw failure('O mapa foi atualizado por outra pessoa. Reabra a versão atual antes de publicar.',409);
 if(blueprint)await references(db,user.org_id,layout,blueprint,user);
 if(blueprint){stampAudit(blueprint,current?parse(rows[0].blueprint_data):null,user);try{blueprint=validateBlueprint(blueprint);}catch(error){throw failure(error.message);}}
 await db.execute(`UPDATE warehouse_layout SET room_w=COALESCE(?,room_w),room_h=COALESCE(?,room_h),door_x=COALESCE(?,door_x),door_y=COALESCE(?,door_y),door_w=COALESCE(?,door_w),aisles=COALESCE(?,aisles),blueprint_data=COALESCE(?,blueprint_data),name=COALESCE(?,name) WHERE id=? AND org_id=?`,[dimensions.room_w,dimensions.room_h,dimensions.door_x,dimensions.door_y,dimensions.door_w,body.aisles===undefined?null:JSON.stringify(body.aisles),blueprint?JSON.stringify(blueprint):null,blueprint?.name?String(blueprint.name).slice(0,100):null,layout,user.org_id]);
 let next=current;if(blueprint){next=current+1;const json=JSON.stringify(blueprint);await db.execute('INSERT INTO warehouse_map_revisions (org_id,layout_id,revision_number,blueprint_json,content_hash,created_by) VALUES (?,?,?,?,?,?)',[user.org_id,layout,next,json,createHash('sha256').update(json).digest('hex'),user.id]);
 // Delete only the author's draft; colleagues retain their recovery state.
 await db.execute('DELETE FROM warehouse_map_drafts WHERE org_id=? AND layout_id=? AND user_id=?',[user.org_id,layout,user.id]);}
 await db.commit();return {message:'Layout publicado',layout_id:layout,revision:next};
 }catch(error){await db.rollback();throw error;}finally{db.release();}
}
async function saveDraft(pool,user,body){let blueprint;try{blueprint=validateBlueprint(body.blueprint_data);}catch(e){throw failure(e.message);}if(!integer(body.base_revision))throw failure('Revisão inválida.');const db=await pool.getConnection();try{await beginMapTransaction(db);const layout=await context.layoutId(db,user.org_id,body.warehouse_id);await db.execute('SELECT id FROM warehouse_layout WHERE id=? AND org_id=? FOR UPDATE',[layout,user.org_id]);if(await revision(db,user.org_id,layout)!==body.base_revision)throw failure('Há uma nova publicação. Seu rascunho continua aberto; reabra o mapa para reconciliar.',409);await references(db,user.org_id,layout,blueprint,user);await db.execute('INSERT INTO warehouse_map_drafts (org_id,layout_id,user_id,base_revision,blueprint_json) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE base_revision=VALUES(base_revision),blueprint_json=VALUES(blueprint_json)',[user.org_id,layout,user.id,body.base_revision,JSON.stringify(blueprint)]);await db.commit();return {saved:true,base_revision:body.base_revision};}catch(e){await db.rollback();throw e;}finally{db.release();}}
let activeImports=0;
function validateImport(bytes,extension){if(activeImports>=2)return Promise.reject(failure('Validador ocupado. Tente importar novamente em alguns segundos.',429));activeImports++;return new Promise((resolve,reject)=>{let worker;try{worker=new Worker(path.join(__dirname,'../security/model-import-worker.js'),{workerData:{bytes,extension},resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:16}});}catch(_){activeImports--;reject(failure('Não foi possível iniciar o validador.'));return;}let settled=false;const finish=(error,result)=>{if(settled)return;settled=true;activeImports--;clearTimeout(timer);worker.terminate();error?reject(error):resolve(result);};const timer=setTimeout(()=>finish(failure('A validação do modelo excedeu o tempo limite.')),5000);worker.on('message',message=>finish(message.ok?null:failure(message.error),message.result));worker.on('error',()=>finish(failure('Não foi possível validar a geometria.')));worker.on('exit',()=>{if(!settled)finish(failure('Validação interrompida.'));});});}
async function importModel(pool,user,body){
 for(const [key,max] of [['name',120],['origin',300],['license',300]])if(typeof body[key]!=='string'||!body[key].trim()||body[key].length>max)throw failure('Informe nome, origem e licença do modelo.');
 if(!['glb','gltf'].includes(body.extension))throw failure('Arquivo inválido. Use GLB ou glTF de até 8 MiB.');
 const bytes=decodeImportBase64(body.base64);
 const layout=await context.layoutId(pool,user.org_id,body.warehouse_id);const model=await validateImport(bytes,body.extension);
 const db=await pool.getConnection();try{await db.beginTransaction();await db.execute('SELECT id FROM organizations WHERE id=? FOR UPDATE',[user.org_id]);
 const [totals]=await db.execute('SELECT COUNT(*) AS total,COALESCE(SUM(source_bytes),0) AS bytes FROM warehouse_model_imports WHERE org_id=?',[user.org_id]);if(Number(totals[0].total)>=100||Number(totals[0].bytes)+bytes.length>100*MAX_BYTES)throw failure('Limite da biblioteca importada atingido.',413);
 const [created]=await db.execute('INSERT INTO warehouse_model_imports (org_id,layout_id,name,source_origin,license_text,source_hash,source_bytes,triangles,geometry_json,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',[user.org_id,layout,body.name.trim(),body.origin.trim(),body.license.trim(),createHash('sha256').update(bytes).digest('hex'),bytes.length,model.triangles,JSON.stringify(model),user.id]);await db.commit();return {id:created.insertId,name:body.name.trim(),modelVersion:'1.0.0',triangles:model.triangles,bounds:model.bounds};
 }catch(error){await db.rollback();throw error;}finally{db.release();}
}
function decodeImportBase64(value){
 // A quantified four-character group exhausts V8's regexp stack on valid 8 MiB files.
 if(typeof value!=='string'||!value.length||value.length%4||value.length>Math.ceil(MAX_BYTES/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw failure('Arquivo inválido. Use GLB ou glTF de até 8 MiB.');
 const bytes=Buffer.from(value,'base64');
 if(bytes.length>MAX_BYTES||bytes.toString('base64')!==value)throw failure('Arquivo inválido. Use GLB ou glTF de até 8 MiB.');
 return bytes;
}
module.exports={revision,references,publish,saveDraft,importModel,validateImport,decodeImportBase64,parse,stampAudit};
