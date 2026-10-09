'use strict';
const express=require('express');
const {fields,invalid}=require('../services/analytics/datasets');
const {compare}=require('../services/analytics/comparison');
module.exports=function createComparison({pool,study,wrap,uuid}){
 const router=express.Router();
 router.get('/studies/:id/comparison',wrap(async(req,res)=>{
  fields(req.query,['from','to','after']);if(!uuid(req.query.from)||!uuid(req.query.to)||req.query.from===req.query.to)invalid('Selecione duas versões diferentes do mesmo estudo.');
  if(req.query.after!==undefined&&(typeof req.query.after!=='string'||!/^\d{1,4}$/.test(req.query.after)||Number(req.query.after)>8000))invalid('Página de diferenças inválida.');
  const item=await study(req);if(!item)return res.status(404).json({error:'Estudo não encontrado.'});
  const [rows]=await pool.execute('SELECT id,version,dataset,content_hash,row_count FROM analytics_snapshots WHERE study_id=? AND org_id=? AND id IN (?,?)',[item.id,req.user.org_id,req.query.from,req.query.to]);
  if(rows.length!==2)return res.status(404).json({error:'Versões não encontradas neste estudo.'});
  res.json(compare(rows.find(row=>row.id===req.query.from),rows.find(row=>row.id===req.query.to),Number(req.query.after||0)));
 }));return router;
};
