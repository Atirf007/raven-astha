'use strict';
const express=require('express'),{fields}=require('../services/analytics/datasets'),validate=require('../services/analytics/drafts');
module.exports=({pool,study,wrap})=>{
 const router=express.Router();
 router.get('/studies/:id/draft',wrap(async(req,res)=>{
  fields(req.query,[]);if(!await study(req))return res.status(404).json({error:'Estudo não encontrado.'});
  const [rows]=await pool.execute('SELECT draft,version FROM analytics_drafts WHERE study_id=? AND BINARY org_id=BINARY ? AND created_by=?',[req.params.id,req.user.org_id,req.user.id]);
  res.json(rows.length?{draft:typeof rows[0].draft==='string'?JSON.parse(rows[0].draft):rows[0].draft,version:rows[0].version}:{draft:null,version:0});
 }));
 async function write(req,res,discard){
  fields(req.body,discard?['version']:['version','draft']);const version=validate.version(req.body.version),content=discard?null:validate.draft(req.body.draft),connection=await pool.getConnection();
  try{
   await connection.beginTransaction();await connection.execute('SELECT id FROM organizations WHERE BINARY id=BINARY ? FOR UPDATE',[req.user.org_id]);
   if(!await study(req,connection)){await connection.rollback();return res.status(404).json({error:'Estudo não encontrado.'});}
   const [previous]=await connection.execute('SELECT version,draft IS NULL AS is_empty FROM analytics_drafts WHERE study_id=? AND BINARY org_id=BINARY ? AND created_by=? FOR UPDATE',[req.params.id,req.user.org_id,req.user.id]);
   if((previous[0]?.version||0)!==version){await connection.rollback();return res.status(409).json({error:'O rascunho foi alterado em outra janela. Recarregue a página para recuperar a versão atual.'});}
   if(!discard&&(!previous.length||previous[0].is_empty)){const [count]=await connection.execute('SELECT COUNT(*) AS total FROM analytics_drafts WHERE BINARY org_id=BINARY ? AND created_by=? AND draft IS NOT NULL',[req.user.org_id,req.user.id]);if(Number(count[0].total)>=8){await connection.rollback();return res.status(409).json({error:'Há oito rascunhos salvos. Publique ou descarte um antes de salvar outro.'});}}
   // Keep only a revision tombstone after discard, preventing an old tab from overwriting a new draft.
   if(discard){if(previous.length)await connection.execute('UPDATE analytics_drafts SET draft=NULL,version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE study_id=? AND BINARY org_id=BINARY ? AND created_by=?',[req.params.id,req.user.org_id,req.user.id]);}
   else if(previous.length)await connection.execute('UPDATE analytics_drafts SET draft=?,version=version+1,updated_at=CURRENT_TIMESTAMP(3) WHERE study_id=? AND BINARY org_id=BINARY ? AND created_by=?',[content,req.params.id,req.user.org_id,req.user.id]);
   else await connection.execute('INSERT INTO analytics_drafts(study_id,org_id,created_by,draft,version) VALUES(?,?,?,?,1)',[req.params.id,req.user.org_id,req.user.id,content]);
   await connection.commit();res.json({version:discard&&!previous.length?0:version+1,discarded:discard});
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
 }
 router.put('/studies/:id/draft',wrap((req,res)=>write(req,res,false)));
 router.delete('/studies/:id/draft',wrap((req,res)=>write(req,res,true)));
 return router;
};
