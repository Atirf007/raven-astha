const express=require('express');
const {pool}=require('../database/connection');
const {requireRoles}=require('../security/authorization');
const Calendar=require('../../renderer/js/maintenance-calendar');
const {poissonForecast}=require('../services/poisson');
const router=express.Router(),write=requireRoles('superadmin','admin','manager');
const id=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
router.get('/plan-templates',async(req,res)=>{try{const [rows]=await pool.execute('SELECT id,name,definition FROM maintenance_plan_templates WHERE org_id=? ORDER BY name',[req.user.org_id]);res.json(rows.map(r=>({...r,definition:typeof r.definition==='string'?JSON.parse(r.definition):r.definition})));}catch(_){res.status(500).json({error:'Erro ao buscar modelos de plano'});}});
router.post('/plan-templates',write,async(req,res)=>{
  const b=req.body||{},d=b.definition||{};
  if(!text(b.name,120)||!Number.isSafeInteger(d.interval_days)||d.interval_days<1||d.interval_days>3650||!Array.isArray(d.tasks)||d.tasks.length>50||d.tasks.some(t=>!text(t,300))||!['urgent','high','medium','low'].includes(d.priority||'medium')||[d.interval_hours,d.interval_cycles].some(v=>v!=null&&(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>1000000)))return res.status(400).json({error:'Modelo de plano inválido'});
  let calendar;try{calendar=Calendar.validate(d.calendar);}catch(e){return res.status(400).json({error:e.message});}
  try{const definition={interval_days:d.interval_days,interval_hours:d.interval_hours??null,interval_cycles:d.interval_cycles??null,tasks:d.tasks.map(t=>t.trim()),priority:d.priority||'medium',calendar};const [r]=await pool.execute('INSERT INTO maintenance_plan_templates (org_id,name,definition,created_by) VALUES (?,?,?,?)',[req.user.org_id,b.name.trim(),JSON.stringify(definition),req.user.id]);res.status(201).json({id:r.insertId});}catch(e){res.status(e.code==='ER_DUP_ENTRY'?409:500).json({error:e.code==='ER_DUP_ENTRY'?'Modelo já cadastrado':'Erro ao salvar modelo'});}
});
router.delete('/plan-templates/:id',write,async(req,res)=>{if(!id(req.params.id))return res.status(400).json({error:'Modelo inválido'});try{const [r]=await pool.execute('DELETE FROM maintenance_plan_templates WHERE id=? AND org_id=?',[id(req.params.id),req.user.org_id]);res.status(r.affectedRows?200:404).json(r.affectedRows?{removed:true}:{error:'Modelo não encontrado'});}catch(_){res.status(500).json({error:'Erro ao remover modelo'});}});
router.get('/reliability/poisson',async(req,res)=>{
  const asset=id(req.query.asset_id),from=new Date(req.query.from),to=new Date(req.query.to),horizon=Number(req.query.horizon_hours||720),confidence=Number(req.query.confidence||0.95);
  if(!asset||!Number.isFinite(+from)||!Number.isFinite(+to)||to<=from||to-from>3650*86400000)return res.status(400).json({error:'Ativo ou período inválido'});
  try{const [assets]=await pool.execute('SELECT id FROM assets WHERE id=? AND org_id=?',[asset,req.user.org_id]);if(!assets.length)return res.status(404).json({error:'Ativo não encontrado'});
    // Existing downtime rows do not establish qualified failures or measured exposure.
    // Validate statistical options without manufacturing either from calendar time.
    try{poissonForecast(0,1,horizon,confidence);}catch(e){return res.status(400).json({error:e.message});}
    res.json({supported:false,reason:'A projeção requer falhas qualificadas e exposição operacional observada. Os registros atuais de parada não comprovam esses dados.',required_data:['qualified_failure_events','observed_operation_hours']});
  }catch(_){res.status(500).json({error:'Erro ao calcular projeção de falhas'});}
});
async function capture(connection,asset,org){
  const [positions]=await connection.execute('SELECT p.id,p.position_number,p.name,p.expected_item_id,p.quantity_required,p.installed_instance_id,i.inventory_item_id AS installed_item_id,i.serial_number FROM component_positions p LEFT JOIN component_instances i ON i.id=p.installed_instance_id AND BINARY i.org_id=BINARY p.org_id WHERE p.equipment_id=? AND p.org_id=? ORDER BY p.id LIMIT 1000',[asset,org]);
  const [spares]=await connection.execute('SELECT material_id,quantity,minimum_quantity,maximum_quantity,functional_location_id FROM asset_spares WHERE asset_id=? AND org_id=? ORDER BY material_id LIMIT 1000',[asset,org]);
  const [parts]=await connection.execute('SELECT visual_id,module_id,component_position_id,tx,ty,tz,rx,ry,rz,scale_factor,explode_dx,explode_dy,explode_dz FROM equipment_assembly_parts WHERE equipment_id=? AND org_id=? ORDER BY visual_id LIMIT 1000',[asset,org]);
  const [external]=await connection.execute('SELECT source_type,source_id,module_id,component_position_id,tx,ty,tz,rx,ry,rz,scale_factor,explode_dx,explode_dy,explode_dz FROM equipment_assembly_external_parts WHERE equipment_id=? AND org_id=? ORDER BY source_type,source_id LIMIT 1000',[asset,org]);
  return {positions,spares,parts,external};
}
router.get('/assets/:id/snapshots',async(req,res)=>{const asset=id(req.params.id);if(!asset)return res.status(400).json({error:'Ativo inválido'});try{const [assets]=await pool.execute('SELECT id FROM assets WHERE id=? AND org_id=?',[asset,req.user.org_id]);if(!assets.length)return res.status(404).json({error:'Ativo não encontrado'});const [rows]=await pool.execute('SELECT id,label,kind,status,created_at,created_by,reviewed_by,reviewed_at,review_note FROM equipment_snapshots WHERE equipment_id=? AND org_id=? ORDER BY id DESC LIMIT 100',[asset,req.user.org_id]);res.json(rows);}catch(_){res.status(500).json({error:'Erro ao buscar versões'});}});
router.post('/assets/:id/snapshots',write,async(req,res)=>{
  const asset=id(req.params.id),b=req.body||{};if(!asset||!text(b.label,120)||!['as_designed','as_built'].includes(b.kind))return res.status(400).json({error:'Versão inválida'});
  const c=await pool.getConnection();try{await c.beginTransaction();const [assets]=await c.execute('SELECT id FROM assets WHERE id=? AND org_id=? FOR UPDATE',[asset,req.user.org_id]);if(!assets.length){await c.rollback();return res.status(404).json({error:'Ativo não encontrado'});}const data=await capture(c,asset,req.user.org_id);const [r]=await c.execute('INSERT INTO equipment_snapshots (org_id,equipment_id,label,kind,snapshot_data,created_by) VALUES (?,?,?,?,?,?)',[req.user.org_id,asset,b.label.trim(),b.kind,JSON.stringify(data),req.user.id]);await c.commit();res.status(201).json({id:r.insertId});}catch(_){await c.rollback();res.status(500).json({error:'Erro ao capturar versão'});}finally{c.release();}
});
router.patch('/assets/:id/snapshots/:snapshotId',write,async(req,res)=>{
  const asset=id(req.params.id),snapshot=id(req.params.snapshotId),b=req.body||{};if(!asset||!snapshot||!['approved','rejected'].includes(b.status)||!text(b.note,300))return res.status(400).json({error:'Revisão inválida'});
  try{const [r]=await pool.execute("UPDATE equipment_snapshots SET status=?,review_note=?,reviewed_by=?,reviewed_at=NOW() WHERE id=? AND equipment_id=? AND org_id=? AND status='draft'",[b.status,b.note.trim(),req.user.id,snapshot,asset,req.user.org_id]);res.status(r.affectedRows?200:409).json(r.affectedRows?{id:snapshot,status:b.status}:{error:'Versão pendente não encontrada'});}catch(_){res.status(500).json({error:'Erro ao revisar versão'});}
});
router.get('/assets/:id/snapshot-comparison',async(req,res)=>{
  const asset=id(req.params.id),left=id(req.query.left),right=id(req.query.right);if(!asset||!left||!right||left===right)return res.status(400).json({error:'Selecione duas versões diferentes'});
  try{const [rows]=await pool.execute('SELECT id,label,kind,status,snapshot_data FROM equipment_snapshots WHERE equipment_id=? AND org_id=? AND id IN (?,?)',[asset,req.user.org_id,left,right]);if(rows.length!==2)return res.status(404).json({error:'Versão não encontrada'});
    const parse=r=>typeof r.snapshot_data==='string'?JSON.parse(r.snapshot_data):r.snapshot_data,a=rows.find(r=>r.id===left),b=rows.find(r=>r.id===right),before=parse(a),after=parse(b),changes=[];
    const keys={positions:r=>String(r.id),spares:r=>String(r.material_id),parts:r=>String(r.visual_id),external:r=>r.source_type+':'+r.source_id};
    for(const [section,key]of Object.entries(keys)){const l=new Map((before[section]||[]).map(r=>[key(r),r])),r=new Map((after[section]||[]).map(r=>[key(r),r]));for(const k of new Set([...l.keys(),...r.keys()])){if(JSON.stringify(l.get(k))!==JSON.stringify(r.get(k)))changes.push({section,key:k,before:l.get(k)||null,after:r.get(k)||null});}}
    res.json({left:{id:a.id,label:a.label,kind:a.kind,status:a.status},right:{id:b.id,label:b.label,kind:b.kind,status:b.status},changes});
  }catch(_){res.status(500).json({error:'Erro ao comparar versões'});}
});
module.exports=router;
