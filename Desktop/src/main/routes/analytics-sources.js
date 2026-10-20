'use strict';
const express=require('express'),{randomUUID,createHash}=require('node:crypto');
const {fields,text,invalid}=require('../services/analytics/datasets');
const condition=require('../services/analytics/condition-source');
module.exports=function createSources({pool,study,admin,wrap,uuid}){
 const router=express.Router();
 // These POSTs create analytical snapshots, but only READ operational EAM data.
 router.use(['/sources/eam','/studies/:id/sources/condition'],require('../middleware/groupAccess')('eam',{action:'read'}));
 async function equipment(org,code,connection=pool){const [rows]=await connection.execute('SELECT id,asset_code,name FROM assets WHERE BINARY org_id=BINARY ? AND BINARY asset_code=BINARY ?',[org,code]);return rows[0];}
 async function read(req,filter,connection=pool){
  const asset=await equipment(req.user.org_id,filter.asset_code,connection);if(!asset)return null;
  const [rows]=await connection.execute("SELECT id,metric_code,value,unit,DATE_FORMAT(recorded_at,'%Y-%m-%d %H:%i:%s') AS recorded_at,source FROM condition_readings WHERE BINARY org_id=BINARY ? AND asset_id=? AND BINARY metric_code=BINARY ? AND BINARY unit=BINARY ? AND recorded_at>=? AND recorded_at<DATE_ADD(?,INTERVAL 1 DAY) ORDER BY recorded_at,id LIMIT 4001",[req.user.org_id,asset.id,filter.metric_code,filter.unit,filter.from+' 00:00:00',filter.through+' 00:00:00']);return condition.snapshot(asset,rows,filter,req.user.org_id);
 }
 router.get('/sources/eam/assets',wrap(async(req,res)=>{
  fields(req.query,['after']);if(req.query.after!==undefined&&!text(req.query.after,40))invalid('Cursor de equipamentos inválido.');
  const [rows]=await pool.execute('SELECT asset_code,name FROM assets WHERE BINARY org_id=BINARY ? AND BINARY asset_code>BINARY ? ORDER BY BINARY asset_code LIMIT 101',[req.user.org_id,req.query.after||'']);res.json({assets:rows.slice(0,100),has_more:rows.length>100,next_cursor:rows.length>100?rows[99].asset_code:null});
 }));
 router.get('/sources/eam/metrics',wrap(async(req,res)=>{
  fields(req.query,['asset_code']);if(!text(req.query.asset_code,40))invalid('Equipamento inválido.');const asset=await equipment(req.user.org_id,req.query.asset_code);if(!asset)return res.status(404).json({error:'Equipamento não encontrado.'});
  const [rows]=await pool.execute('SELECT DISTINCT metric_code,unit FROM condition_readings WHERE BINARY org_id=BINARY ? AND asset_id=? ORDER BY metric_code,unit LIMIT 101',[req.user.org_id,asset.id]);if(rows.length>100)invalid('Mais de cem combinações de métrica/unidade. É necessário um filtro específico antes da análise.');res.json({metrics:rows});
 }));
 router.post('/studies/:id/sources/condition/preview',wrap(async(req,res)=>{
  const item=await study(req);if(!item)return res.status(404).json({error:'Estudo não encontrado.'});const filter=condition.selection(req.body),data=await read(req,filter);if(!data)return res.status(404).json({error:'Equipamento não encontrado.'});
  res.json({sha256:data.hash,variable:data.data.variable,row_count:data.rows,preview:data.data.rows.slice(0,20),provenance:{...data.data.provenance,records:data.data.provenance.records.slice(0,20)},limitations:['Uma linha por leitura. Medições repetidas do mesmo equipamento não demonstram vidas independentes.','Período usa o relógio DATETIME armazenado no banco; fuso não é inferido nem convertido.','Somente a unidade escolhida é incluída. Outras unidades não são convertidas ou somadas.']});
 }));
 router.get('/studies/:id/sources/condition/live',wrap(async(req,res)=>{
  if(!await study(req))return res.status(404).json({error:'Estudo não encontrado.'});
  const filter=condition.selection(req.query),data=await read(req,filter);
  if(!data)return res.status(404).json({error:'Equipamento não encontrado.'});
  // Read-only, bounded operational preview. Never publish or enqueue on a timer.
  res.json({sha256:data.hash,dataset:data.data,row_count:data.rows,checked_at:new Date().toISOString(),published:false});
 }));
 router.post('/studies/:id/sources/condition/publish',wrap(async(req,res)=>{
  fields(req.body,['selection','expected_hash','request_key']);const filter=condition.selection(req.body.selection);if(!uuid(req.body.request_key)||typeof req.body.expected_hash!=='string'||!/^[a-f0-9]{64}$/.test(req.body.expected_hash))invalid('Confirme a prévia e a chave de publicação.');
  const requestHash=createHash('sha256').update(JSON.stringify({study:req.params.id,filter,hash:req.body.expected_hash})).digest('hex'),connection=await pool.getConnection();
  try{
   await connection.beginTransaction();await connection.execute('SELECT id FROM organizations WHERE BINARY id=BINARY ? FOR UPDATE',[req.user.org_id]);const [owners]=await connection.execute('SELECT id FROM analytics_studies WHERE id=? AND org_id=? AND (created_by=? OR ?=1)',[req.params.id,req.user.org_id,req.user.id,admin(req)]);if(!owners.length){await connection.rollback();return res.status(404).json({error:'Estudo não encontrado.'});}
   const [existing]=await connection.execute('SELECT snapshot_id,request_hash FROM analytics_source_publications WHERE org_id=? AND created_by=? AND request_key=?',[req.user.org_id,req.user.id,req.body.request_key]);if(existing.length){if(existing[0].request_hash!==requestHash){await connection.rollback();return res.status(409).json({error:'Chave já utilizada em outra publicação.'});}await connection.commit();return res.json({id:existing[0].snapshot_id,already_published:true});}
   const data=await read(req,filter,connection);if(!data){await connection.rollback();return res.status(404).json({error:'Equipamento não encontrado.'});}if(data.hash!==req.body.expected_hash){await connection.rollback();return res.status(409).json({error:'As leituras mudaram desde a prévia. Confira novamente antes de publicar.'});}
   const [latest]=await connection.execute('SELECT COALESCE(MAX(version),0) AS version FROM analytics_snapshots WHERE study_id=? AND org_id=?',[req.params.id,req.user.org_id]);const version=Number(latest[0].version)+1,id=randomUUID();
   await connection.execute('INSERT INTO analytics_snapshots (id,study_id,org_id,version,dataset,content_hash,row_count,created_by) VALUES (?,?,?,?,?,?,?,?)',[id,req.params.id,req.user.org_id,version,data.content,data.hash,data.rows,req.user.id]);
   await connection.execute('INSERT INTO analytics_source_publications (org_id,created_by,request_key,request_hash,study_id,snapshot_id) VALUES (?,?,?,?,?,?)',[req.user.org_id,req.user.id,req.body.request_key,requestHash,req.params.id,id]);await connection.commit();res.status(201).json({id,version,row_count:data.rows,content_hash:data.hash});
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
 }));
 return router;
};
