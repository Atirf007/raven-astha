'use strict';
const express=require('express');
const {randomUUID,createHash}=require('node:crypto');
const auth=require('../middleware/auth');
const {pool}=require('../database/connection');
const {dataset,analysis,text,fields,invalid}=require('../services/analytics/datasets');
const {createProcessor}=require('../services/analytics/jobs');
const {evidence,csv,canonical,hash}=require('../services/analytics/evidence');
const {inspect,inspectEvidence}=require('../services/analytics/inspection');
const {artifact}=require('../services/analytics/artifacts');
const router=express.Router(),processor=createProcessor(pool);
const parser=require('../services/analytics/parser-runner');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const admin=req=>['admin','superadmin'].includes(req.user.role)?1:0;
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(error){const status=error.status===400?400:503;res.status(status).json({error:status===400?error.message:'Estúdio indisponível. Verifique a conexão segura e a instalação do schema analítico.'});}};
router.use(auth,(req,res,next)=>['superadmin','admin','manager'].includes(req.user.role)?next():res.status(403).json({error:'Seu papel não possui permissão para estudos analíticos.'}));
async function study(req,connection=pool){
 if(!uuid(req.params.id))invalid('Estudo inválido.');
 const [rows]=await connection.execute('SELECT id,name,question,created_by,created_at FROM analytics_studies WHERE id=? AND org_id=? AND (created_by=? OR ?=1)',[req.params.id,req.user.org_id,req.user.id,admin(req)]);
 return rows[0];
}
async function ownedJob(req){
 if(!uuid(req.params.jobId))invalid('Execução inválida.');
 const [rows]=await pool.execute('SELECT j.id,j.study_id,j.snapshot_id,j.method,j.status,j.attempts,j.created_at,j.completed_at,j.error_code,j.result,j.created_by FROM analytics_jobs j JOIN analytics_studies s ON s.id=j.study_id AND BINARY s.org_id=BINARY j.org_id WHERE j.id=? AND j.org_id=? AND (s.created_by=? OR ?=1)',[req.params.jobId,req.user.org_id,req.user.id,admin(req)]);
 return rows[0];
}
router.get('/catalog',wrap(async(req,res)=>{res.json({schema:'analytics-catalog/1',execution_enabled:process.env.ANALYTICS_TRUSTED_RUNNER==='true',imports_enabled:parser.configured(),limits:{rows:4000,bytes:2097152},methods:[{id:'normal-reference/1',kind:'measurements',label:'Histograma e curva de Gauss · comparação exploratória',status:'exploratory'},{id:'age-hazard/1',kind:'life',label:'Taxa de falha por idade · investigação da banheira',status:'exploratory'},{id:'pareto/1',kind:'categories',label:'Pareto de perdas por categoria',status:'exploratory'},{id:'descriptive/1',kind:'measurements',label:'Estatística descritiva',status:'exploratory'},{id:'kaplan-meier-right/1',kind:'life',label:'Kaplan–Meier · censura à direita',status:'exploratory'},{id:'weibull-2p-right/1',kind:'life',label:'Weibull 2P · censura à direita',status:'exploratory'}],permissions:{create:true,publish:true,execute:true,export:true,scope:admin(req)?'organization':'own-studies'}});}));
router.use('/studies/:id/imports',require('./analytics-imports')({pool,study,admin,wrap,uuid}));
router.use(require('./analytics-sources')({pool,study,admin,wrap,uuid}));
router.use(require('./analytics-operational')({pool,wrap}));
router.use(require('./analytics-comparison')({pool,study,wrap,uuid}));
router.use(require('./analytics-drafts')({pool,study,wrap}));
router.get('/studies',wrap(async(req,res)=>{
 fields(req.query,['after']);let cursor=null;
 if(req.query.after!==undefined){
  if(!uuid(req.query.after))invalid('Cursor de estudos inválido.');
  const [found]=await pool.execute('SELECT id,created_at FROM analytics_studies WHERE id=? AND org_id=? AND (created_by=? OR ?=1)',[req.query.after,req.user.org_id,req.user.id,admin(req)]);
  if(!found.length)return res.status(404).json({error:'Página não disponível.'});cursor=found[0];
 }
 const [rows]=cursor?await pool.execute('SELECT id,name,question,created_at FROM analytics_studies WHERE org_id=? AND (created_by=? OR ?=1) AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 101',[req.user.org_id,req.user.id,admin(req),cursor.created_at,cursor.created_at,cursor.id]):await pool.execute('SELECT id,name,question,created_at FROM analytics_studies WHERE org_id=? AND (created_by=? OR ?=1) ORDER BY created_at DESC,id DESC LIMIT 101',[req.user.org_id,req.user.id,admin(req)]);
 res.json({studies:rows.slice(0,100),has_more:rows.length>100,next_cursor:rows.length>100?rows[99].id:null});
}));
router.post('/studies',wrap(async(req,res)=>{
 fields(req.body,['name','question']);if(!text(req.body.name,120)||!text(req.body.question,1000))invalid('Informe nome e pergunta do estudo.');
 const id=randomUUID();await pool.execute('INSERT INTO analytics_studies (id,org_id,name,question,created_by) VALUES (?,?,?,?,?)',[id,req.user.org_id,req.body.name.trim(),req.body.question.trim(),req.user.id]);res.status(201).json({id});
}));
router.get('/studies/:id',wrap(async(req,res)=>{
 const item=await study(req);if(!item)return res.status(404).json({error:'Estudo não encontrado.'});
 const [versions]=await pool.execute('SELECT id,version,content_hash,row_count,created_at FROM analytics_snapshots WHERE study_id=? AND org_id=? ORDER BY version DESC LIMIT 101',[item.id,req.user.org_id]);
 const [jobs]=await pool.execute('SELECT id,snapshot_id,method,status,attempts,created_at,completed_at FROM analytics_jobs WHERE study_id=? AND org_id=? ORDER BY created_at DESC,id DESC LIMIT 51',[item.id,req.user.org_id]);
 res.json({...item,versions:versions.slice(0,100),jobs:jobs.slice(0,50),more_versions:versions.length>100,more_jobs:jobs.length>50,version_cursor:versions.length>100?versions[99].version:null,job_cursor:jobs.length>50?jobs[49].id:null});
}));
router.get('/studies/:id/versions',wrap(async(req,res)=>{
 fields(req.query,['before']);const item=await study(req);if(!item)return res.status(404).json({error:'Estudo não encontrado.'});
 const before=req.query.before===undefined?4294967296:Number(req.query.before);
 if(req.query.before!==undefined&&(typeof req.query.before!=='string'||!/^\d{1,10}$/.test(req.query.before)||!Number.isSafeInteger(before)||before<1||before>4294967295))invalid('Cursor de versões inválido.');
 const [rows]=await pool.execute('SELECT id,version,content_hash,row_count,created_at FROM analytics_snapshots WHERE study_id=? AND org_id=? AND version<? ORDER BY version DESC LIMIT 101',[item.id,req.user.org_id,before]);
 res.json({versions:rows.slice(0,100),has_more:rows.length>100,next_cursor:rows.length>100?rows[99].version:null});
}));
router.get('/studies/:id/jobs',wrap(async(req,res)=>{
 fields(req.query,['after']);const item=await study(req);if(!item)return res.status(404).json({error:'Estudo não encontrado.'});let cursor=null;
 if(req.query.after!==undefined){
  if(!uuid(req.query.after))invalid('Cursor de execuções inválido.');
  const [found]=await pool.execute('SELECT id,created_at FROM analytics_jobs WHERE id=? AND study_id=? AND org_id=?',[req.query.after,item.id,req.user.org_id]);
  if(!found.length)return res.status(404).json({error:'Página não disponível.'});cursor=found[0];
 }
 const [rows]=cursor?await pool.execute('SELECT id,snapshot_id,method,status,attempts,created_at,completed_at FROM analytics_jobs WHERE study_id=? AND org_id=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 51',[item.id,req.user.org_id,cursor.created_at,cursor.created_at,cursor.id]):await pool.execute('SELECT id,snapshot_id,method,status,attempts,created_at,completed_at FROM analytics_jobs WHERE study_id=? AND org_id=? ORDER BY created_at DESC,id DESC LIMIT 51',[item.id,req.user.org_id]);
 res.json({jobs:rows.slice(0,50),has_more:rows.length>50,next_cursor:rows.length>50?rows[49].id:null});
}));
router.post('/studies/:id/snapshots',wrap(async(req,res)=>{
 if(!uuid(req.params.id))invalid('Estudo inválido.');
 const snapshot=dataset(req.body),connection=await pool.getConnection();
 try{
  await connection.beginTransaction();
  await connection.execute('SELECT id FROM organizations WHERE BINARY id=BINARY ? FOR UPDATE',[req.user.org_id]);const [owners]=await connection.execute('SELECT id FROM analytics_studies WHERE id=? AND org_id=? AND (created_by=? OR ?=1)',[req.params.id,req.user.org_id,req.user.id,admin(req)]);
  if(!owners.length){await connection.rollback();return res.status(404).json({error:'Estudo não encontrado.'});}
  const [latest]=await connection.execute('SELECT COALESCE(MAX(version),0) AS version FROM analytics_snapshots WHERE study_id=? AND org_id=?',[req.params.id,req.user.org_id]);
  const version=Number(latest[0].version)+1,id=randomUUID();
  await connection.execute('INSERT INTO analytics_snapshots (id,study_id,org_id,version,dataset,content_hash,row_count,created_by) VALUES (?,?,?,?,?,?,?,?)',[id,req.params.id,req.user.org_id,version,snapshot.content,snapshot.hash,snapshot.rows,req.user.id]);
  await connection.commit();res.status(201).json({id,version,content_hash:snapshot.hash,row_count:snapshot.rows});
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}));
router.get('/studies/:id/snapshots/:snapshotId',wrap(async(req,res)=>{
 const item=await study(req);if(!item)return res.status(404).json({error:'Estudo não encontrado.'});
 if(!uuid(req.params.snapshotId))invalid('Versão inválida.');
 const [rows]=await pool.execute('SELECT id,version,dataset,content_hash,row_count,created_at FROM analytics_snapshots WHERE id=? AND study_id=? AND org_id=?',[req.params.snapshotId,item.id,req.user.org_id]);
 if(!rows.length)return res.status(404).json({error:'Versão não encontrada.'});
 res.json({...rows[0],dataset:parse(rows[0].dataset)});
}));
router.get('/studies/:id/snapshots/:snapshotId/inspection',wrap(async(req,res)=>{
 fields(req.query,['after']);
 if(req.query.after!==undefined&&!/^(0|[1-9][0-9]{0,3})$/.test(String(req.query.after)))invalid('Página de observações inválida.');
 if(req.query.after!==undefined&&typeof req.query.after!=='string')invalid('Página de observações inválida.');
 const item=await study(req);if(!item)return res.status(404).json({error:'Estudo não encontrado.'});
 if(!uuid(req.params.snapshotId))invalid('Versão inválida.');
 const [rows]=await pool.execute('SELECT id,version,dataset,content_hash,row_count,created_at FROM analytics_snapshots WHERE id=? AND study_id=? AND org_id=?',[req.params.snapshotId,item.id,req.user.org_id]);
 if(!rows.length)return res.status(404).json({error:'Versão não encontrada.'});
 res.json(inspect(rows[0],Number(req.query.after||0)));
}));
router.post('/studies/:id/jobs',wrap(async(req,res)=>{
 fields(req.body,['snapshot_id','method','parameters','request_key']);
 if(!uuid(req.body.snapshot_id)||!uuid(req.body.request_key))invalid('Informe versão e chave da execução.');
 if(process.env.ANALYTICS_TRUSTED_RUNNER!=='true')return res.status(503).json({error:'Execução analítica não habilitada no servidor.'});
 const item=await study(req);if(!item)return res.status(404).json({error:'Estudo não encontrado.'});
 const [versions]=await pool.execute('SELECT dataset,content_hash FROM analytics_snapshots WHERE id=? AND study_id=? AND org_id=?',[req.body.snapshot_id,item.id,req.user.org_id]);
 if(!versions.length)return res.status(404).json({error:'Versão não encontrada.'});
 const parameters=analysis(parse(versions[0].dataset),req.body.method,req.body.parameters||{});
 const requestHash=createHash('sha256').update(JSON.stringify({study:item.id,snapshot:req.body.snapshot_id,method:req.body.method,parameters})).digest('hex');
 const connection=await pool.getConnection();let result;
 try{
  await connection.beginTransaction();
  // Serialize admission per tenant so concurrent submissions cannot bypass the quota.
  const [organization]=await connection.execute('SELECT id FROM organizations WHERE BINARY id=BINARY ? FOR UPDATE',[req.user.org_id]);
  if(!organization.length){await connection.rollback();return res.status(503).json({error:'Organização indisponível para execução.'});}
  const [existing]=await connection.execute('SELECT id,request_hash FROM analytics_jobs WHERE org_id=? AND created_by=? AND request_key=?',[req.user.org_id,req.user.id,req.body.request_key]);
  if(existing.length){if(existing[0].request_hash!==requestHash){await connection.rollback();return res.status(409).json({error:'Chave já utilizada com outra solicitação.'});}result={id:existing[0].id};}
  else{
   const [counts]=await connection.execute("SELECT COUNT(*) AS active FROM analytics_jobs WHERE org_id=? AND status IN ('queued','running')",[req.user.org_id]);
   if(Number(counts[0].active)>=3){await connection.rollback();return res.status(429).json({error:'Há três execuções pendentes nesta organização. Aguarde ou cancele uma delas.'});}
   const id=randomUUID();await connection.execute('INSERT INTO analytics_jobs (id,org_id,study_id,snapshot_id,request_key,request_hash,method,parameters,created_by) VALUES (?,?,?,?,?,?,?,?,?)',[id,req.user.org_id,item.id,req.body.snapshot_id,req.body.request_key,requestHash,req.body.method,JSON.stringify(parameters),req.user.id]);result={id};
  }
  await connection.commit();
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
 res.status(202).json(result);setImmediate(()=>processor.tick().catch(()=>{}));
}));
router.get('/jobs/:jobId',wrap(async(req,res)=>{const job=await ownedJob(req);if(!job)return res.status(404).json({error:'Execução não encontrada.'});const {created_by,...publicJob}=job;res.json({...publicJob,can_review:Boolean(admin(req)&&created_by!==req.user.id&&job.status==='completed'),result:job.result?parse(job.result):null});}));
router.post('/jobs/:jobId/cancel',wrap(async(req,res)=>{
 const job=await ownedJob(req);if(!job)return res.status(404).json({error:'Execução não encontrada.'});
 const [updated]=await pool.execute("UPDATE analytics_jobs SET status='cancelled',completed_at=NOW(3) WHERE id=? AND org_id=? AND status IN ('queued','running')",[job.id,req.user.org_id]);
 if(!updated.affectedRows)return res.status(409).json({error:'Execução já encerrada.'});res.json({id:job.id,status:'cancelled'});
}));
router.get('/jobs/:jobId/export',wrap(async(req,res)=>{
 const job=await ownedJob(req);if(!job)return res.status(404).json({error:'Execução não encontrada.'});
 if(job.status!=='completed'||!job.result)return res.status(409).json({error:'Resultado ainda não disponível.'});
 res.setHeader('Content-Disposition','attachment; filename="astha-estudo.json"');
 res.json({schema:'astha-export/1',method:job.method,result:parse(job.result),limitations:['Resultado exploratório; não representa aprovação para uma ação operacional.'],exported_at:new Date().toISOString()});
}));
async function packageFor(req){
 const job=await ownedJob(req);if(!job)return null;
 if(job.status!=='completed'||!job.result){const error=Error('Resultado ainda não disponível.');error.status=400;throw error;}
 const [studies]=await pool.execute('SELECT name,question FROM analytics_studies WHERE id=? AND org_id=?',[job.study_id,req.user.org_id]);
 const [snapshots]=await pool.execute('SELECT id,version,dataset,content_hash FROM analytics_snapshots WHERE id=? AND study_id=? AND org_id=?',[job.snapshot_id,job.study_id,req.user.org_id]);
 const [reviews]=await pool.execute('SELECT decision,note,reviewer_name,result_hash,created_at FROM analytics_reviews WHERE job_id=? AND org_id=? ORDER BY created_at,id LIMIT 101',[job.id,req.user.org_id]);
 if(!studies.length||!snapshots.length||reviews.length>100)throw Error('EVIDENCE_INCOMPLETE');
 return evidence(studies[0],snapshots[0],job,reviews);
}
router.get('/jobs/:jobId/package',wrap(async(req,res)=>{const data=await packageFor(req);if(!data)return res.status(404).json({error:'Execução não encontrada.'});res.setHeader('Content-Disposition','attachment; filename="astha-evidencias.json"');res.json(data);}));
router.get('/jobs/:jobId/report',wrap(async(req,res)=>{const data=await packageFor(req);if(!data)return res.status(404).json({error:'Execução não encontrada.'});res.json(data);}));
router.get('/jobs/:jobId/inspection',wrap(async(req,res)=>{
 fields(req.query,['after']);
 if(req.query.after!==undefined&&(typeof req.query.after!=='string'||!/^(0|[1-9][0-9]{0,3})$/.test(req.query.after)))invalid('Página de observações inválida.');
 const data=await packageFor(req);if(!data)return res.status(404).json({error:'Execução não encontrada.'});
 res.json(inspectEvidence(data,Number(req.query.after||0)));
}));
router.get('/jobs/:jobId/csv',wrap(async(req,res)=>{const data=await packageFor(req);if(!data)return res.status(404).json({error:'Execução não encontrada.'});res.setHeader('Content-Disposition','attachment; filename="astha-observacoes.csv"');res.type('text/csv; charset=utf-8').send(csv(data.snapshot.dataset));}));
router.post('/jobs/:jobId/artifacts',wrap(async(req,res)=>{
 fields(req.body,['profile','preview','expected_sha256']);
 if(typeof req.body.preview!=='boolean')invalid('Informe se deseja conferir ou baixar a exportação.');
 if(!req.body.preview&&(typeof req.body.expected_sha256!=='string'||!/^[a-f0-9]{64}$/.test(req.body.expected_sha256)))invalid('Confira a prévia antes de baixar.');
 const data=await packageFor(req);if(!data)return res.status(404).json({error:'Execução não encontrada.'});
 const output=artifact(data,req.body.profile);
 if(!req.body.preview&&req.body.expected_sha256!==output.sha256)return res.status(409).json({error:'As evidências mudaram desde a prévia. Confira novamente antes de baixar.'});
 res.setHeader('Cache-Control','private, no-store');
 const {content,...summary}=output;res.json(req.body.preview?summary:output);
}));
router.post('/jobs/:jobId/reviews',wrap(async(req,res)=>{
 fields(req.body,['decision','note']);
 if(!admin(req))return res.status(403).json({error:'Somente administradores podem registrar revisão documental.'});
 if(!['accepted','rejected'].includes(req.body.decision)||!text(req.body.note,2000))invalid('Informe decisão e justificativa de até 2.000 caracteres.');
 const job=await ownedJob(req);if(!job)return res.status(404).json({error:'Execução não encontrada.'});
 if(job.created_by===req.user.id)return res.status(403).json({error:'A revisão exige pessoa diferente de quem executou a análise.'});
 if(job.status!=='completed'||!job.result)return res.status(409).json({error:'Somente resultados concluídos podem ser revisados.'});
 // Integrity is checked before recording an opinion about the frozen result.
 await packageFor(req);
 const [users]=await pool.execute('SELECT name FROM users WHERE id=? AND org_id=? AND is_active=1',[req.user.id,req.user.org_id]);
 if(!users.length)return res.status(403).json({error:'Revisor indisponível.'});
 const id=randomUUID(),resultHash=hash(canonical(parse(job.result)));
 try{await pool.execute('INSERT INTO analytics_reviews (id,job_id,org_id,reviewer_id,reviewer_name,decision,note,result_hash) VALUES (?,?,?,?,?,?,?,?)',[id,job.id,req.user.org_id,req.user.id,users[0].name.slice(0,150),req.body.decision,req.body.note.trim(),resultHash]);}
 catch(error){if(error.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Sua revisão já está registrada. Uma nova análise exige nova execução.'});throw error;}
 res.status(201).json({id,decision:req.body.decision,result_sha256:resultHash});
}));
router.startProcessor=()=>{const stopJobs=process.env.ANALYTICS_TRUSTED_RUNNER==='true'?processor.start():()=>{};const stopImports=process.env.ANALYTICS_FILE_IMPORTS==='true'?require('../services/analytics/import-maintenance').startImportCleanup(pool):()=>{};return()=>{stopJobs();stopImports();};};
module.exports=router;
