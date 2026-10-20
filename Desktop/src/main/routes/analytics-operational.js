'use strict';
const express=require('express');
const {fields,text,invalid}=require('../services/analytics/datasets');
const qualified=require('../services/qualified-observations');
const {createHash}=require('node:crypto');
module.exports=({pool,wrap})=>{
 const router=express.Router();
 router.get('/sources/eam/operational',require('../middleware/groupAccess')('eam',{action:'read'}),wrap(async(req,res)=>{
  fields(req.query,['asset_code','metric_code','unit','days','from','through']);
  for(const [key,max] of [['asset_code',40],['metric_code',64],['unit',24]])if(req.query[key]!==undefined&&!text(req.query[key],max))invalid('Filtro inválido.');
  const days=req.query.days===undefined?30:Number(req.query.days);if(![7,30,90,365].includes(days))invalid('Período inválido.');
  const now=new Date(),date=value=>{if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)invalid('Data inválida.');return new Date(value+'T00:00:00Z');};
  const from=req.query.from?date(req.query.from):new Date(+now-days*86400000),to=req.query.through?new Date(Math.min(+now,+date(req.query.through)+86400000)):now;
  if(to<=from||to-from>366*86400000)invalid('Escolha um período de até 366 dias.');
  const org=req.user.org_id,connection=await pool.getConnection();
  let payload;
  try{
   // One consistent database snapshot per refresh; no jobs or saved versions are created.
   await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
   const [assets]=await connection.execute('SELECT a.id,a.asset_code,a.name FROM assets a WHERE BINARY a.org_id=BINARY ? ORDER BY (SELECT MAX(c.recorded_at) FROM condition_readings c WHERE BINARY c.org_id=BINARY a.org_id AND c.asset_id=a.id) DESC,a.asset_code LIMIT 501',[org]);
   if(assets.length>500)invalid('Mais de 500 equipamentos: reduza o escopo antes de monitorar.');
   const selected=req.query.asset_code?assets.find(a=>a.asset_code===req.query.asset_code):assets[0];
   if(req.query.asset_code&&!selected){await connection.rollback();return res.status(404).json({error:'Equipamento não encontrado.'});}
   const [downtime]=await connection.execute('SELECT d.asset_id,d.started_at,d.ended_at,d.work_order_id,d.production_loss_cost,wo.type FROM downtime_records d JOIN maintenance_work_orders wo ON wo.id=d.work_order_id AND BINARY wo.org_id=BINARY d.org_id WHERE BINARY d.org_id=BINARY ? AND d.started_at<? AND (d.ended_at>? OR d.ended_at IS NULL) ORDER BY d.asset_id,d.started_at LIMIT 10001',[org,qualified.sqlTime(to),qualified.sqlTime(from)]);
   const [observations]=await connection.execute('SELECT asset_id,kind,'+qualified.utcColumns+' FROM asset_observations WHERE BINARY org_id=BINARY ? AND started_at<? AND ended_at>? ORDER BY asset_id,started_at LIMIT 4001',[org,qualified.sqlTime(to),qualified.sqlTime(from)]);
   if(downtime.length>10000||observations.length>4000)invalid('Muitos registros: escolha um período menor.');
   const reliability=assets.map(asset=>{const report=qualified.report({from,to,rows:downtime.filter(r=>String(r.asset_id)===String(asset.id)),observations:observations.filter(r=>String(r.asset_id)===String(asset.id))});return{asset_code:asset.asset_code,name:asset.name,mttr_hours:report.mttr_hours,mtbf_hours:report.mtbf_hours,availability:report.availability,downtime_hours:report.downtime_hours,failures:report.failures,completed_repairs:report.completed_repairs||0,operation_hours:report.exposure.observed_operation_hours,unknown_hours:report.exposure.unknown_hours,conflicting_hours:report.exposure.conflicting_hours,warnings:report.warnings};});
   let metrics=[],readings=[],metric=null;
   if(selected){
    [metrics]=await connection.execute('SELECT metric_code,unit,MAX(recorded_at) AS latest_at FROM condition_readings WHERE BINARY org_id=BINARY ? AND asset_id=? GROUP BY metric_code,unit ORDER BY latest_at DESC,metric_code,unit LIMIT 101',[org,selected.id]);
    if(metrics.length>100)invalid('Mais de cem métricas: reduza o escopo de monitoramento.');
    metric=req.query.metric_code?metrics.find(m=>m.metric_code===req.query.metric_code&&m.unit===req.query.unit):metrics[0]||null;
    if(req.query.metric_code&&!metric)invalid('Métrica ou unidade não disponível para este equipamento.');
    if(metric){[readings]=await connection.execute("SELECT value,DATE_FORMAT(recorded_at,'%Y-%m-%d %H:%i:%s') AS recorded_at FROM condition_readings WHERE BINARY org_id=BINARY ? AND asset_id=? AND BINARY metric_code=BINARY ? AND BINARY unit=BINARY ? AND recorded_at>=? AND recorded_at<? ORDER BY recorded_at,id LIMIT 4001",[org,selected.id,metric.metric_code,metric.unit,qualified.sqlTime(from),qualified.sqlTime(to)]);if(readings.length>4000)invalid('Mais de 4.000 leituras: escolha um período menor.');}
   }
   const repairs=selected?observations.filter(r=>String(r.asset_id)===String(selected.id)&&r.kind==='failure'&&+new Date(r.started_at)>=+from&&+new Date(r.repair_started_at)>=+from&&+new Date(r.repair_ended_at)<=+to).map(r=>({recorded_at:r.repair_ended_at,hours:(+new Date(r.repair_ended_at)-+new Date(r.repair_started_at))/3600000})):[];
   payload={period:{from:from.toISOString(),to:to.toISOString()},assets:assets.map(({asset_code,name})=>({asset_code,name})),selected:selected?.asset_code||null,metrics:metrics.map(({metric_code,unit})=>({metric_code,unit})),metric:metric?{metric_code:metric.metric_code,unit:metric.unit}:null,readings:readings.map(r=>({value:r.value===null?null:Number(r.value),recorded_at:r.recorded_at})),reliability,repairs};
   await connection.commit();
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
  // Moving clock alone must not reset chart zoom/focus when the underlying data is unchanged.
  const {period,...content}=payload;
  res.set('Cache-Control','no-store');res.json({...payload,sha256:createHash('sha256').update(JSON.stringify(content)).digest('hex'),checked_at:now.toISOString(),refresh_seconds:5});
 }));
 return router;
};
