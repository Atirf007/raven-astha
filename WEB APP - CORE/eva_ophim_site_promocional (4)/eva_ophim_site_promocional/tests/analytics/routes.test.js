const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {randomUUID}=require('node:crypto');
const studies=[],snapshots=[],jobs=[],calls=[],reviews=[];
let creator=1;
async function execute(sql,args=[]){
 calls.push({sql,args});
 if(sql.startsWith('INSERT INTO analytics_studies')){const [id,org_id,name,question,created_by]=args;studies.push({id,org_id,name,question,created_by});return [{affectedRows:1}];}
 if(sql.startsWith('SELECT id,name,question,created_at FROM analytics_studies')){let rows=studies.filter(s=>s.org_id===args[0]&&(s.created_by===args[1]||args[2]));if(args.length>3)rows=rows.filter(s=>s.created_at<args[3]||(s.created_at===args[4]&&s.id<args[5]));return [rows.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||b.id.localeCompare(a.id)).slice(0,101)];}
 if(sql.startsWith('SELECT id,created_at FROM analytics_studies'))return [studies.filter(s=>s.id===args[0]&&s.org_id===args[1]&&(s.created_by===args[2]||args[3]))];
 if(sql.startsWith('SELECT id,created_at FROM analytics_jobs'))return [jobs.filter(j=>j.id===args[0]&&j.study_id===args[1]&&j.org_id===args[2])];
 if(sql.startsWith('SELECT id,name,question,created_by')||sql.startsWith('SELECT id FROM analytics_studies'))return [studies.filter(s=>s.id===args[0]&&s.org_id===args[1]&&(s.created_by===args[2]||args[3]))];
 if(sql.startsWith('SELECT name,question FROM analytics_studies'))return [studies.filter(s=>s.id===args[0]&&s.org_id===args[1])];
 if(sql.startsWith('SELECT decision,note,reviewer_name'))return [reviews.filter(r=>r.job_id===args[0]&&r.org_id===args[1])];
 if(sql.startsWith('SELECT name FROM users'))return [[{name:'Revisor <script>inert</script>'}]];
 if(sql.startsWith('INSERT INTO analytics_reviews')){const [id,job_id,org_id,reviewer_id,reviewer_name,decision,note,result_hash]=args;if(reviews.some(r=>r.job_id===job_id&&r.reviewer_id===reviewer_id)){const error=Error();error.code='ER_DUP_ENTRY';throw error;}reviews.push({id,job_id,org_id,reviewer_id,reviewer_name,decision,note,result_hash,created_at:'2026-09-30T12:00:00Z'});return [{affectedRows:1}];}
 if(sql.startsWith('SELECT COALESCE(MAX(version)'))return [[{version:Math.max(0,...snapshots.filter(s=>s.study_id===args[0]&&s.org_id===args[1]).map(s=>s.version))}]];
 if(sql.startsWith('INSERT INTO analytics_snapshots')){const [id,study_id,org_id,version,data,content_hash,row_count,created_by]=args;snapshots.push({id,study_id,org_id,version,dataset:JSON.parse(data),content_hash,row_count,created_by});return [{affectedRows:1}];}
 if(sql.startsWith('SELECT id,version,content_hash'))return [snapshots.filter(s=>s.study_id===args[0]&&s.org_id===args[1]&&(args.length<3||s.version<args[2])).sort((a,b)=>b.version-a.version).slice(0,101)];
 if(sql.startsWith('SELECT id,version,dataset'))return [snapshots.filter(s=>s.id===args[0]&&s.study_id===args[1]&&s.org_id===args[2])];
 if(sql.startsWith('SELECT dataset,content_hash'))return [snapshots.filter(s=>s.id===args[0]&&s.study_id===args[1]&&s.org_id===args[2])];
 if(sql.startsWith('SELECT id,snapshot_id,method,status')){let rows=jobs.filter(j=>j.study_id===args[0]&&j.org_id===args[1]);if(args.length>2)rows=rows.filter(j=>j.created_at<args[2]||(j.created_at===args[3]&&j.id<args[4]));return [rows.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||b.id.localeCompare(a.id)).slice(0,51)];}
 if(sql.startsWith('SELECT id FROM organizations'))return [[{id:args[0]}]];
 if(sql.startsWith('SELECT id,request_hash FROM analytics_jobs'))return [jobs.filter(j=>j.org_id===args[0]&&j.created_by===args[1]&&j.request_key===args[2])];
 if(sql.startsWith('SELECT COUNT(*) AS active'))return [[{active:jobs.filter(j=>j.org_id===args[0]&&['queued','running'].includes(j.status)).length}]];
 if(sql.startsWith('INSERT INTO analytics_jobs')){const [id,org_id,study_id,snapshot_id,request_key,request_hash,method,parameters,created_by]=args;jobs.push({id,org_id,study_id,snapshot_id,request_key,request_hash,method,parameters,created_by,status:'queued',attempts:0,result:null});return [{affectedRows:1}];}
 if(sql.startsWith('SELECT j.id,j.study_id'))return [jobs.filter(j=>j.id===args[0]&&j.org_id===args[1]&&studies.some(s=>s.id===j.study_id&&(s.created_by===args[2]||args[3])))];
 if(sql.startsWith("UPDATE analytics_jobs SET status='cancelled'")){const job=jobs.find(j=>j.id===args[0]&&j.org_id===args[1]&&['queued','running'].includes(j.status));if(job)job.status='cancelled';return [{affectedRows:job?1:0}];}
 if(sql.startsWith("UPDATE analytics_jobs SET status='failed'"))return [{affectedRows:0}];
 if(sql.startsWith('SELECT j.*,s.dataset'))return [[]]; // Processor lifecycle is exercised separately.
 throw Error('Unrecognized test SQL');
}
const pool={execute,getConnection:async()=>({execute,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}})};
const db=require.resolve('../../api/database/connection');require.cache[db]={id:db,filename:db,loaded:true,exports:{pool}};
const auth=require.resolve('../../api/middleware/auth');require.cache[auth]={id:auth,filename:auth,loaded:true,exports:(req,res,next)=>{if(!req.headers['x-test-org'])return res.sendStatus(401);req.user={id:Number(req.headers['x-test-user']||creator),org_id:req.headers['x-test-org'],role:req.headers['x-test-role']||'manager'};next();}};
process.env.ANALYTICS_TRUSTED_RUNNER='true';
const express=require('../../api/node_modules/express'),app=express();app.use(express.json());app.use('/analytics',require('../../api/routes/analytics'));
test('study, immutable revisions, admission, ownership and private exports retain tenant boundaries',async()=>{
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=(url,{method='GET',body,org='A',user=1,role='manager'}={})=>fetch(`http://127.0.0.1:${server.address().port}/analytics${url}`,{method,headers:{'content-type':'application/json','x-test-org':org,'x-test-user':String(user),'x-test-role':role},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await request('/catalog',{role:'viewer'})).status,403);
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/analytics/studies`)).status,401);
  const create=await request('/studies',{method:'POST',body:{name:'Temperatura',question:'Como varia a temperatura?'}});assert.equal(create.status,201);const {id}=await create.json();
  assert.equal((await request('/studies/'+id,{org:'B',role:'superadmin'})).status,404);
  assert.equal((await request('/studies/'+id,{user:2})).status,404);
  assert.equal((await request('/studies/'+id,{user:2,role:'admin'})).status,200);
  const data={kind:'measurements',variable:{name:'T',unit:'C'},rows:[{subject_id:'A',value:10},{subject_id:'B',value:null}]};
  const first=await request(`/studies/${id}/snapshots`,{method:'POST',body:data});assert.equal(first.status,201);const version=await first.json();assert.equal(version.version,1);
  const changed={...data,rows:[{subject_id:'A',value:20}]};const second=await request(`/studies/${id}/snapshots`,{method:'POST',body:changed});assert.equal((await second.json()).version,2);
  assert.equal((await (await request(`/studies/${id}/snapshots/${version.id}`)).json()).dataset.rows[0].value,10);
  assert.equal((await request(`/studies/${id}/snapshots`,{method:'POST',org:'B',body:data})).status,404);
  const inspectionUrl=`/studies/${id}/snapshots/${version.id}/inspection`;
  assert.equal((await request(inspectionUrl,{org:'B',role:'superadmin'})).status,404);
  assert.equal((await request(inspectionUrl,{user:2})).status,404);
  assert.equal((await request(inspectionUrl+'?after[]=0')).status,400);
  assert.equal((await request(inspectionUrl+'?after=0%20OR%201=1')).status,400);
  assert.equal((await request(inspectionUrl+'?after=3')).status,400);
  const checked=await (await request(inspectionUrl)).json();assert.equal(checked.counts.missing,1);assert.equal(checked.observations[0].value,10);assert.equal(checked.sha256,version.content_hash);
  const body={snapshot_id:version.id,method:'descriptive/1',parameters:{},request_key:randomUUID()};
  const queued=await request(`/studies/${id}/jobs`,{method:'POST',body});assert.equal(queued.status,202);const job=await queued.json();
  assert.equal((await (await request(`/studies/${id}/jobs`,{method:'POST',body})).json()).id,job.id);assert.equal(jobs.length,1);
  assert.equal((await request(`/studies/${id}/jobs`,{method:'POST',body:{...body,snapshot_id:snapshots[1].id}})).status,409);
  assert.equal((await request(`/jobs/${job.id}`,{org:'B',role:'superadmin'})).status,404);
  assert.equal((await request(`/jobs/${job.id}/export`)).status,409);
  for(let i=0;i<2;i++)assert.equal((await request(`/studies/${id}/jobs`,{method:'POST',body:{...body,request_key:randomUUID()}})).status,202);
  assert.equal((await request(`/studies/${id}/jobs`,{method:'POST',body:{...body,request_key:randomUUID()}})).status,429);
  assert.equal((await request(`/jobs/${job.id}/cancel`,{method:'POST',body:{}})).status,200);
  assert.equal((await request(`/jobs/${job.id}/cancel`,{method:'POST',body:{}})).status,409);
  const complete=jobs[1];complete.status='completed';complete.result={schema:'astha-result/1',result:{mean:15}};
  assert.equal((await request(`/jobs/${complete.id}/export`)).status,200);assert.equal((await request(`/jobs/${complete.id}/export`,{org:'B'})).status,404);
  const {run}=require('../../api/services/analytics/runner');
  const source=snapshots.find(s=>s.id===complete.snapshot_id),output=await run(source.dataset,complete.method,{});
  complete.result={...output,snapshot_id:source.id,snapshot_hash:source.content_hash,parameters:{},variable:source.dataset.variable,source:'manual-entry'};
  for(const action of ['report','package','csv'])assert.equal((await request(`/jobs/${complete.id}/${action}`,{org:'B',role:'superadmin'})).status,404);
  const pack=await (await request(`/jobs/${complete.id}/package`)).json();assert.equal(pack.snapshot.dataset.rows[0].value,10);assert.equal(pack.recipe.engine.node,process.version);assert.equal(pack.reviews.length,0);
  const replay=await run(pack.snapshot.dataset,pack.recipe.method,pack.recipe.parameters);assert.deepEqual(replay.result,pack.result.result);
  const csv=await request(`/jobs/${complete.id}/csv`);assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);assert.match(await csv.text(),/subject_id/);
  assert.equal((await request(`/jobs/${complete.id}/inspection`,{org:'B',role:'superadmin'})).status,404);
  assert.equal((await request(`/jobs/${complete.id}/inspection`,{user:2})).status,404);
  const graph=await (await request(`/jobs/${complete.id}/inspection`)).json();assert.equal(graph.nodes.length,6);assert.equal(graph.nodes.at(-1).description,'Nenhuma revisão registrada');
  const exportUrl=`/jobs/${complete.id}/artifacts`,profile={format:'package',identifiers:true};
  for(const access of [{org:'B',role:'superadmin'},{user:2},{role:'viewer'}])assert.notEqual((await request(exportUrl,{method:'POST',body:{profile,preview:true},...access})).status,200);
  const previewResponse=await request(exportUrl,{method:'POST',body:{profile,preview:true}});assert.equal(previewResponse.status,200);assert.equal(previewResponse.headers.get('cache-control'),'private, no-store');const preview=await previewResponse.json();assert.equal(preview.content,undefined);
  assert.equal((await request(exportUrl,{method:'POST',body:{profile,preview:false}})).status,400);
  assert.equal((await request(exportUrl,{method:'POST',body:{profile,preview:false,expected_sha256:'a'.repeat(64)}})).status,409);
  const downloaded=await request(exportUrl,{method:'POST',body:{profile,preview:false,expected_sha256:preview.sha256}});assert.equal(downloaded.status,200);assert.equal(require('../../api/services/analytics/evidence').hash((await downloaded.json()).content),preview.sha256);
  const review={method:'POST',body:{decision:'accepted',note:'Dados e hipóteses conferidos.'}};
  assert.equal((await request(`/jobs/${complete.id}/reviews`,review)).status,403);
  assert.equal((await request(`/jobs/${complete.id}/reviews`,{...review,role:'admin'})).status,403);
  assert.equal((await request(`/jobs/${complete.id}/reviews`,{...review,role:'superadmin',user:2,org:'B'})).status,404);
  assert.equal((await request(`/jobs/${complete.id}/reviews`,{...review,role:'admin',user:2})).status,201);
  assert.equal((await request(`/jobs/${complete.id}/reviews`,{...review,role:'admin',user:2})).status,409);
  assert.equal((await (await request(`/jobs/${complete.id}/report`)).json()).reviews[0].decision,'accepted');
  assert.equal((await request(exportUrl,{method:'POST',body:{profile,preview:false,expected_sha256:preview.sha256}})).status,409);
  const reviewedGraph=await (await request(`/jobs/${complete.id}/inspection`)).json();assert.equal(reviewedGraph.nodes.at(-1).details[0][1],review.body.note);
  const frozen=complete.result.snapshot_hash;complete.result.snapshot_hash='corrupted';assert.equal((await request(`/jobs/${complete.id}/package`)).status,503);complete.result.snapshot_hash=frozen;
  assert(calls.some(call=>call.sql.includes('FOR UPDATE')&&call.sql.includes('organizations')));
  assert(!calls.some(call=>/^UPDATE analytics_snapshots/.test(call.sql)));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('cursor pages expose the whole authorized history without duplicates or foreign cursor access',async()=>{
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=(url,org='P',user=31,role='manager')=>fetch(`http://127.0.0.1:${server.address().port}/analytics${url}`,{headers:{'x-test-org':org,'x-test-user':String(user),'x-test-role':role}});
 const timestamp='2026-10-01T10:00:00.000Z',studyId=randomUUID();
 for(let i=0;i<105;i++)studies.push({id:i===0?studyId:randomUUID(),org_id:'P',created_by:31,name:'S'+i,question:'Q',created_at:timestamp});
 const foreign={id:randomUUID(),org_id:'X',created_by:31,created_at:timestamp};studies.push(foreign);
 const colleague={id:randomUUID(),org_id:'P',created_by:32,created_at:timestamp};studies.push(colleague);
 for(let i=1;i<=105;i++)snapshots.push({id:randomUUID(),study_id:studyId,org_id:'P',version:i,row_count:1});
 for(let i=0;i<55;i++)jobs.push({id:randomUUID(),study_id:studyId,org_id:'P',created_by:31,created_at:timestamp,method:'descriptive/1',status:'completed'});
 try{
  const first=await (await request('/studies')).json();assert.equal(first.studies.length,100);assert.equal(first.has_more,true);
  const second=await (await request('/studies?after='+first.next_cursor)).json();assert.equal(second.studies.length,5);assert.equal(second.has_more,false);assert.equal(new Set([...first.studies,...second.studies].map(s=>s.id)).size,105);
  assert.equal((await request('/studies?after='+foreign.id,'P',31,'superadmin')).status,404);assert.equal((await request('/studies?after='+colleague.id)).status,404);assert.equal((await request('/studies?after=invalid')).status,400);
  const detail=await (await request('/studies/'+studyId)).json();assert.equal(detail.versions.length,100);assert.equal(detail.version_cursor,6);assert.equal(detail.jobs.length,50);
  const versions=await (await request(`/studies/${studyId}/versions?before=${detail.version_cursor}`)).json();assert.deepEqual(versions.versions.map(v=>v.version),[5,4,3,2,1]);assert.equal(versions.has_more,false);
  const nextJobs=await (await request(`/studies/${studyId}/jobs?after=${detail.job_cursor}`)).json();assert.equal(nextJobs.jobs.length,5);assert.equal(new Set([...detail.jobs,...nextJobs.jobs].map(j=>j.id)).size,55);
  assert.equal((await request(`/studies/${studyId}/versions?before=0`)).status,400);assert.equal((await request(`/studies/${studyId}/versions?before[]=3`)).status,400);
  assert.equal((await request(`/studies/${studyId}/jobs?after=${jobs[0].id}`)).status,404);
  assert.equal((await request(`/studies/${studyId}/versions?before=6`,'X',31,'superadmin')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
