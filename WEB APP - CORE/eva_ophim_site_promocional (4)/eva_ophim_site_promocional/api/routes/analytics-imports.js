'use strict';
const express=require('express');
const {randomUUID}=require('node:crypto');
const {fields,invalid,restore}=require('../services/analytics/datasets');
const {upload,mapped}=require('../services/analytics/imports');
const parser=require('../services/analytics/parser-runner');
module.exports=function createImports({pool,study,admin,wrap,uuid}){
 const router=express.Router({mergeParams:true}),json=value=>typeof value==='string'?JSON.parse(value):value;
 async function own(req,connection=pool,lock=false){
  if(!uuid(req.params.importId))invalid('Importação inválida.');
  const [rows]=await connection.execute('SELECT i.*,COALESCE(i.expires_at<=NOW(3),1) AS is_expired FROM analytics_imports i JOIN analytics_studies s ON s.id=i.study_id AND BINARY s.org_id=BINARY i.org_id WHERE i.id=? AND i.study_id=? AND i.org_id=? AND i.created_by=? AND (s.created_by=? OR ?=1)'+(lock?' FOR UPDATE OF i':''),[req.params.importId,req.params.id,req.user.org_id,req.user.id,req.user.id,admin(req)]);return rows[0];
 }
 // Admission, reads and publication use the same database clock, regardless of API host timezone.
 const expired=item=>Number(item.is_expired)!==0;
 function summary(item){const table=item.table_data?json(item.table_data):null;return {id:item.id,status:item.status,format:item.format,origin:item.origin,raw_sha256:item.raw_sha256,expires_at:item.expires_at,columns:table?.columns||[],row_count:table?.rows.length||0,preview:table?.rows.slice(0,20)||[],snapshot_id:item.snapshot_id||null,mapping:item.mapped_data?json(item.mapped_data).provenance.mapping:null};}
 router.get('/',wrap(async(req,res)=>{const item=await study(req);if(!item)return res.status(404).json({error:'Estudo não encontrado.'});const [rows]=await pool.execute("SELECT id,status,format,origin,raw_sha256,expires_at FROM analytics_imports WHERE study_id=? AND org_id=? AND created_by=? AND status='ready' AND expires_at>NOW(3) ORDER BY created_at DESC,id DESC LIMIT 10",[item.id,req.user.org_id,req.user.id]);res.json({imports:rows});}));
 router.post('/',wrap(async(req,res)=>{
  if(!parser.configured())return res.status(503).json({error:'Importação exige parser isolado configurado no servidor. A digitação permanece disponível.'});
  const file=upload(req.body),item=await study(req);if(!item)return res.status(404).json({error:'Estudo não encontrado.'});
  const id=randomUUID(),connection=await pool.getConnection();
  try{
   await connection.beginTransaction();const [organization]=await connection.execute('SELECT id FROM organizations WHERE BINARY id=BINARY ? FOR UPDATE',[req.user.org_id]);if(!organization.length){await connection.rollback();return res.status(503).json({error:'Organização indisponível.'});}
   await connection.execute("UPDATE analytics_imports SET status='expired',raw_data=NULL,table_data=NULL,mapped_data=NULL WHERE org_id=? AND expires_at<NOW(3) AND status<>'published'",[req.user.org_id]);
   const [counts]=await connection.execute('SELECT COUNT(*) AS total FROM analytics_imports WHERE org_id=? AND created_at>DATE_SUB(NOW(3),INTERVAL 24 HOUR)',[req.user.org_id]);
   if(Number(counts[0].total)>=10){await connection.rollback();return res.status(429).json({error:'Limite de dez arquivos em 24 horas nesta organização. Reutilize a prévia existente.'});}
   await connection.execute('INSERT INTO analytics_imports (id,study_id,org_id,created_by,format,origin,raw_sha256,raw_data,expires_at) VALUES (?,?,?,?,?,?,?,?,DATE_ADD(NOW(3),INTERVAL 24 HOUR))',[id,item.id,req.user.org_id,req.user.id,file.format,file.origin,file.hash,file.raw]);await connection.commit();
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
  const controller=new AbortController(),cancel=()=>{if(!res.writableEnded)controller.abort();};req.once('aborted',cancel);res.once('close',cancel);
  try{
   const parsed=await parser.parse({format:file.format,delimiter:file.delimiter,content:file.raw.toString('base64')},{signal:controller.signal});
   // Re-check live permission after the potentially long parser operation.
   const [updated]=await pool.execute("UPDATE analytics_imports i JOIN users u ON u.id=i.created_by AND BINARY u.org_id=BINARY i.org_id JOIN analytics_studies s ON s.id=i.study_id AND BINARY s.org_id=BINARY i.org_id SET i.status='ready',i.table_data=?,i.parser_engine=? WHERE i.id=? AND i.org_id=? AND i.status='quarantined' AND i.expires_at>NOW(3) AND u.is_active=1 AND (u.role IN ('admin','superadmin') OR (u.role='manager' AND s.created_by=u.id))",[JSON.stringify(parsed.table),JSON.stringify(parsed.engine),id,req.user.org_id]);
   if(!updated.affectedRows)return res.status(403).json({error:'Acesso alterado durante a importação.'});
   res.status(201).json({id,status:'ready',format:file.format,origin:file.origin,raw_sha256:file.hash,columns:parsed.table.columns,row_count:parsed.table.rows.length,preview:parsed.table.rows.slice(0,20)});
  }catch(error){await pool.execute("UPDATE analytics_imports SET status='failed',raw_data=NULL WHERE id=? AND org_id=? AND status='quarantined'",[id,req.user.org_id]);if(error.status===400)throw error;res.status(503).json({error:'Parser isolado indisponível ou sem recursos. Nenhum arquivo foi processado no servidor web.'});}finally{req.removeListener('aborted',cancel);res.removeListener('close',cancel);}
 }));
 router.get('/:importId',wrap(async(req,res)=>{const item=await own(req);if(!item)return res.status(404).json({error:'Importação não encontrada.'});if(expired(item)&&item.status!=='published')return res.status(410).json({error:'Prévia expirada. Envie o arquivo novamente.'});res.json(summary(item));}));
 router.post('/:importId/mapping',wrap(async(req,res)=>{
  const item=await own(req);if(!item)return res.status(404).json({error:'Importação não encontrada.'});if(expired(item))return res.status(410).json({error:'Prévia expirada.'});if(item.status!=='ready')return res.status(409).json({error:'Arquivo não disponível para mapeamento.'});
  const data=mapped(json(item.table_data),req.body,{import_id:item.id,raw_sha256:item.raw_sha256,format:item.format,origin:item.origin,parser:json(item.parser_engine)});
  const [updated]=await pool.execute("UPDATE analytics_imports SET mapped_data=?,mapped_hash=? WHERE id=? AND org_id=? AND created_by=? AND status='ready' AND expires_at>NOW(3)",[data.content,data.hash,item.id,req.user.org_id,req.user.id]);if(!updated.affectedRows)return res.status(409).json({error:'Importação mudou. Atualize a prévia.'});
  res.json({sha256:data.hash,row_count:data.rows,kind:data.data.kind,variable:data.data.variable,preview:data.data.rows.slice(0,20),provenance:data.data.provenance});
 }));
 router.post('/:importId/publish',wrap(async(req,res)=>{
  fields(req.body,['expected_hash']);if(typeof req.body.expected_hash!=='string'||!/^[a-f0-9]{64}$/.test(req.body.expected_hash))invalid('Confirme o hash da prévia revisada.');
  const connection=await pool.getConnection();
  try{
   await connection.beginTransaction();await connection.execute('SELECT id FROM organizations WHERE BINARY id=BINARY ? FOR UPDATE',[req.user.org_id]);const [owners]=await connection.execute('SELECT id FROM analytics_studies WHERE id=? AND org_id=? AND (created_by=? OR ?=1)',[req.params.id,req.user.org_id,req.user.id,admin(req)]);if(!owners.length){await connection.rollback();return res.status(404).json({error:'Estudo não encontrado.'});}
   const item=await own(req,connection,true);if(!item){await connection.rollback();return res.status(404).json({error:'Importação não encontrada.'});}
   if(item.mapped_hash!==req.body.expected_hash){await connection.rollback();return res.status(409).json({error:'Mapeamento mudou. Revise novamente a prévia.'});}
   if(item.status==='published'){await connection.commit();return res.json({id:item.snapshot_id,already_published:true});}
   if(expired(item)||item.status!=='ready'||!item.mapped_data){await connection.rollback();return res.status(409).json({error:'Prévia indisponível para publicação.'});}
   const data=restore(json(item.mapped_data));if(data.hash!==item.mapped_hash)throw Error('IMPORT_INTEGRITY');
   const [latest]=await connection.execute('SELECT COALESCE(MAX(version),0) AS version FROM analytics_snapshots WHERE study_id=? AND org_id=?',[req.params.id,req.user.org_id]);const version=Number(latest[0].version)+1,id=randomUUID();
   await connection.execute('INSERT INTO analytics_snapshots (id,study_id,org_id,version,dataset,content_hash,row_count,created_by) VALUES (?,?,?,?,?,?,?,?)',[id,req.params.id,req.user.org_id,version,data.content,data.hash,data.rows,req.user.id]);
   await connection.execute("UPDATE analytics_imports SET status='published',snapshot_id=?,raw_data=NULL,table_data=NULL,mapped_data=NULL WHERE id=? AND org_id=?",[id,item.id,req.user.org_id]);await connection.commit();res.status(201).json({id,version,row_count:data.rows,content_hash:data.hash});
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
 }));
 return router;
};
