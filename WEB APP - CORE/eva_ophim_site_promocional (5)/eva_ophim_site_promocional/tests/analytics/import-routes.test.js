'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {randomUUID}=require('node:crypto');
const {parseFile}=require('../../api/services/analytics/file-parser');
const imports=[],snapshots=[],calls=[],studyId=randomUUID();let revoked=false;
const engine={image:'node@sha256:'+'a'.repeat(64),source_sha256:'b'.repeat(64),runtime:process.version,isolation:'container-no-network-read-only'};
async function execute(sql,args=[]){
 calls.push({sql,args});
 if(sql.startsWith('SELECT id,name,question,created_by')||sql.startsWith('SELECT id FROM analytics_studies'))return [args[0]===studyId&&args[1]==='A'&&(args[2]===1||args[3])?[{id:studyId,created_by:1,name:'Estudo',question:'Pergunta'}]:[]];
 if(sql.startsWith('SELECT id FROM organizations'))return [[{id:args[0]}]];
 if(sql.startsWith('SELECT id,status,format,origin'))return [imports.filter(i=>i.study_id===args[0]&&i.org_id===args[1]&&i.created_by===args[2]&&i.status==='ready'&&i.expires_at>Date.now()).map(({id,status,format,origin,raw_sha256,expires_at})=>({id,status,format,origin,raw_sha256,expires_at}))];
 if(sql.startsWith("UPDATE analytics_imports SET status='expired'"))return [{affectedRows:0}];
 if(sql.startsWith('SELECT COUNT(*) AS total'))return [[{total:imports.filter(i=>i.org_id===args[0]).length}]];
 if(sql.startsWith('INSERT INTO analytics_imports')){const [id,study_id,org_id,created_by,format,origin,raw_sha256,raw_data]=args;imports.push({id,study_id,org_id,created_by,format,origin,raw_sha256,raw_data,status:'quarantined',expires_at:new Date(Date.now()+86400000)});return [{affectedRows:1}];}
 if(sql.startsWith('UPDATE analytics_imports i JOIN users')){const item=imports.find(i=>i.id===args[2]&&i.org_id===args[3]);if(item&&!revoked){Object.assign(item,{status:'ready',table_data:JSON.parse(args[0]),parser_engine:JSON.parse(args[1])});return [{affectedRows:1}];}return [{affectedRows:0}];}
 if(sql.startsWith("UPDATE analytics_imports SET status='failed'")){const item=imports.find(i=>i.id===args[0]);if(item){item.status='failed';item.raw_data=null;}return [{affectedRows:1}];}
 if(sql.startsWith('SELECT i.*')){assert(sql.includes('COALESCE(i.expires_at<=NOW(3),1) AS is_expired'));return [imports.filter(i=>i.id===args[0]&&i.study_id===args[1]&&i.org_id===args[2]&&i.created_by===args[3]&&(args[4]===1||args[5])).map(item=>({...item,is_expired:item.expiryOverride??Number(item.expires_at<=Date.now())}))];}
 if(sql.startsWith('UPDATE analytics_imports SET mapped_data')){const item=imports.find(i=>i.id===args[2]&&i.org_id===args[3]&&i.created_by===args[4]&&i.status==='ready');if(item){item.mapped_data=JSON.parse(args[0]);item.mapped_hash=args[1];}return [{affectedRows:item?1:0}];}
 if(sql.startsWith('SELECT COALESCE(MAX(version)'))return [[{version:snapshots.length}]];
 if(sql.startsWith('INSERT INTO analytics_snapshots')){const [id,study_id,org_id,version,dataset,content_hash,row_count,created_by]=args;snapshots.push({id,study_id,org_id,version,dataset:JSON.parse(dataset),content_hash,row_count,created_by});return [{affectedRows:1}];}
 if(sql.startsWith("UPDATE analytics_imports SET status='published'")){const item=imports.find(i=>i.id===args[1]);Object.assign(item,{status:'published',snapshot_id:args[0],raw_data:null,table_data:null,mapped_data:null});return [{affectedRows:1}];}
 throw Error('Unrecognized SQL in test: '+sql);
}
const pool={execute,getConnection:async()=>({execute,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}})};
const db=require.resolve('../../api/database/connection');require.cache[db]={id:db,filename:db,loaded:true,exports:{pool}};
const auth=require.resolve('../../api/middleware/auth');require.cache[auth]={id:auth,filename:auth,loaded:true,exports:(req,res,next)=>{if(!req.headers['x-test-org'])return res.sendStatus(401);req.user={id:Number(req.headers['x-test-user']||1),org_id:req.headers['x-test-org'],role:req.headers['x-test-role']||'manager'};next();}};
const parser=require.resolve('../../api/services/analytics/parser-runner');require.cache[parser]={id:parser,filename:parser,loaded:true,exports:{configured:()=>true,parse:async input=>({table:parseFile(input),engine})}};
const express=require('../../api/node_modules/express'),app=express();app.use(express.json({limit:'4mb'}));app.use('/analytics',require('../../api/routes/analytics'));
test('private quarantine, mapping, preview confirmation and idempotent immutable publication',async()=>{
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=(url,{method='GET',body,org='A',user=1,role='manager'}={})=>fetch(`http://127.0.0.1:${server.address().port}/analytics${url}`,{method,headers:{'content-type':'application/json','x-test-org':org,'x-test-user':String(user),'x-test-role':role},body:body?JSON.stringify(body):undefined});
 const root=`/studies/${studyId}/imports`,file={format:'csv',delimiter:';',origin:'Bancada <script>inert</script>',content:Buffer.from('id;valor\n0001;0\n0002;\n').toString('base64')};
 try{
  assert.equal((await request(root,{method:'POST',body:file,org:'B',role:'superadmin'})).status,404);
  assert.equal((await request(root,{method:'POST',body:file,role:'viewer'})).status,403);
  const created=await request(root,{method:'POST',body:file});assert.equal(created.status,201);const ready=await created.json();assert.deepEqual(ready.columns,['id','valor']);assert(!Object.hasOwn(ready,'raw_data'));
  assert.equal((await (await request(root)).json()).imports.length,1);assert.equal((await request(root,{org:'B',role:'superadmin'})).status,404);assert.equal((await (await request(root,{user:2,role:'admin'})).json()).imports.length,0);
  const base=root+'/'+ready.id;assert.equal((await request(base,{org:'B',role:'superadmin'})).status,404);assert.equal((await request(base,{user:2,role:'admin'})).status,404);
  imports[0].expiryOverride=1;assert.equal((await request(base)).status,410);imports[0].expiryOverride=0;
  const mapping={kind:'measurements',variable:{name:'Temperatura',unit:'C'},subject_column:'id',value_column:'valor',decimal:'.'};
  assert.equal((await request(base+'/mapping',{method:'POST',body:{...mapping,org_id:'B'}})).status,400);
  const preview=await (await request(base+'/mapping',{method:'POST',body:mapping})).json();assert.equal(preview.preview[0].subject_id,'0001');assert.equal(preview.preview[0].value,0);assert.equal(preview.preview[1].value,null);
  assert.equal((await request(base+'/publish',{method:'POST',body:{expected_hash:'f'.repeat(64)}})).status,409);
  const publish={method:'POST',body:{expected_hash:preview.sha256}};assert.equal((await request(base+'/publish',publish)).status,201);const count=snapshots.length;
  const repeated=await (await request(base+'/publish',publish)).json();assert.equal(repeated.already_published,true);assert.equal(snapshots.length,count);
  assert.equal(snapshots[0].dataset.provenance.raw_sha256,ready.raw_sha256);assert.deepEqual(snapshots[0].dataset.provenance.parser,engine);
  assert.equal(imports[0].raw_data,null);assert.equal(imports[0].table_data,null);assert.equal(imports[0].mapped_data,null);
  const {run}=require('../../api/services/analytics/runner'),{evidence}=require('../../api/services/analytics/evidence');const frozen=snapshots[0],result=await run(frozen.dataset,'descriptive/1',{});
  const pack=evidence({name:'Estudo',question:'Pergunta'},frozen,{status:'completed',method:'descriptive/1',result:{...result,parameters:{},snapshot_id:frozen.id,snapshot_hash:frozen.content_hash}});assert.equal(pack.snapshot.dataset.source,'file-import');assert.equal(pack.result.result.mean,0);assert.equal(pack.result.result.missing,1);
  const next=await (await request(root,{method:'POST',body:file})).json(),item=imports.find(i=>i.id===next.id);item.expires_at=new Date(0);assert.equal((await request(root+'/'+next.id+'/mapping',{method:'POST',body:mapping})).status,410);
  revoked=true;assert.equal((await request(root,{method:'POST',body:file})).status,403);revoked=false;
  for(let i=imports.length;i<10;i++)imports.push({org_id:'A'});assert.equal((await request(root,{method:'POST',body:file})).status,429);
  assert(calls.filter(c=>c.sql.startsWith('INSERT INTO')).every(c=>!c.sql.includes(file.origin)));assert(calls.some(c=>c.sql.includes('FOR UPDATE')));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
