'use strict';
const express=require('express'),{randomUUID}=require('node:crypto'),{pool}=require('../database/connection'),{requireRoles}=require('../security/authorization'),{input,utcColumns}=require('../services/qualified-observations');
const router=express.Router();
router.get('/assets/:id/observations',async(req,res)=>{
 const id=Number(req.params.id),after=req.query.after;
 if(!Number.isSafeInteger(id)||id<1||Object.keys(req.query).some(key=>key!=='after')||(after!==undefined&&(typeof after!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(after))))return res.status(400).json({error:'Ativo ou cursor inválido.'});
 try{
  const [asset]=await pool.execute('SELECT id FROM assets WHERE id=? AND BINARY org_id=BINARY ?',[id,req.user.org_id]);if(!asset.length)return res.status(404).json({error:'Ativo não encontrado.'});
  let boundary=null;
  if(after!==undefined){const [previous]=await pool.execute("SELECT DATE_FORMAT(started_at,'%Y-%m-%d %H:%i:%s.%f') AS started_at,id FROM asset_observations WHERE id=? AND asset_id=? AND BINARY org_id=BINARY ?",[after,id,req.user.org_id]);if(!previous.length)return res.status(400).json({error:'Cursor não pertence ao histórico deste equipamento.'});boundary=previous[0];}
  const clause=boundary?' AND (started_at<? OR (started_at=? AND id<?))':'';
  const [rows]=await pool.execute('SELECT id,kind,'+utcColumns+',source,notes,recorded_by,created_at FROM asset_observations WHERE asset_id=? AND BINARY org_id=BINARY ?'+clause+' ORDER BY started_at DESC,id DESC LIMIT 101',[id,req.user.org_id,...(boundary?[boundary.started_at,boundary.started_at,boundary.id]:[])]);
  res.json({records:rows.slice(0,100),has_more:rows.length>100,next_cursor:rows.length>100?rows[99].id:null});
 }catch(_){res.status(500).json({error:'Registros indisponíveis.'});}
});
router.post('/assets/:id/observations',requireRoles('superadmin','admin','manager','operator'),async(req,res)=>{
 const assetId=Number(req.params.id);let value;try{if(!Number.isSafeInteger(assetId)||assetId<1)throw Error('Ativo inválido.');value=input(req.body);}catch(error){return res.status(400).json({error:error.message});}
 let c;try{c=await pool.getConnection();await c.beginTransaction();const [asset]=await c.execute('SELECT id FROM assets WHERE id=? AND BINARY org_id=BINARY ? FOR UPDATE',[assetId,req.user.org_id]);if(!asset.length){await c.rollback();return res.status(404).json({error:'Ativo não encontrado.'});}
  const [previous]=await c.execute('SELECT id,content_hash FROM asset_observations WHERE asset_id=? AND BINARY org_id=BINARY ? AND request_key=?',[assetId,req.user.org_id,req.body.request_key]);if(previous.length){await c.rollback();return previous[0].content_hash===value.hash?res.json({id:previous[0].id,already_recorded:true}):res.status(409).json({error:'Identificação reutilizada com conteúdo diferente.'});}
  const [conflict]=await c.execute('SELECT id FROM asset_observations WHERE asset_id=? AND BINARY org_id=BINARY ? AND started_at<? AND ended_at>? LIMIT 1',[assetId,req.user.org_id,value.dates[1],value.dates[0]]);if(conflict.length){await c.rollback();return res.status(409).json({error:'O intervalo se sobrepõe a uma observação existente.'});}
  const id=randomUUID();await c.execute('INSERT INTO asset_observations(id,org_id,asset_id,request_key,content_hash,kind,started_at,ended_at,repair_started_at,repair_ended_at,source,notes,recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,req.user.org_id,assetId,req.body.request_key,value.hash,value.record.kind,...value.dates,value.record.source,value.record.notes,req.user.id]);await c.commit();res.status(201).json({id});
 }catch(_){await c?.rollback().catch(()=>{});res.status(500).json({error:'Não foi possível registrar a observação.'});}finally{c?.release();}
});
module.exports=router;
