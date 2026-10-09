'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{randomUUID}=require('node:crypto');
const studyId=randomUUID(),snapshots=[],receipts=[],calls=[];let access={eam:{read:true,write:false}},readings=[{id:1,metric_code:'temperature',unit:'C',value:'0.000000',recorded_at:'2026-09-01 10:00:00',source:'manual'}];
async function execute(sql,args=[]){
 calls.push({sql,args});
 if(sql.startsWith('SELECT id FROM organizations'))return [[{id:args[0]}]];
 if(sql.startsWith('SELECT g.permissions'))return [[{permissions:access}]];
 if(sql.startsWith('SELECT id,name,question,created_by')||sql.startsWith('SELECT id FROM analytics_studies'))return [args[0]===studyId&&args[1]==='A'&&(args[2]===1||args[3])?[{id:studyId,created_by:1,name:'Estudo',question:'Pergunta'}]:[]];
 if(sql.startsWith('SELECT asset_code,name'))return [args[0]==='A'?[{asset_code:'P-01',name:'Bomba'}]:[]];
 if(sql.startsWith('SELECT id,asset_code,name FROM assets'))return [args[0]==='A'&&args[1]==='P-01'?[{id:19,asset_code:'P-01',name:'Bomba'}]:[]];
 if(sql.startsWith('SELECT DISTINCT metric_code'))return [[{metric_code:'temperature',unit:'C'}]];
 if(sql.startsWith('SELECT id,metric_code,value'))return [args[0]==='A'&&args[1]===19&&args[2]==='temperature'&&args[3]==='C'?readings:[]];
 if(sql.startsWith('SELECT snapshot_id,request_hash'))return [receipts.filter(i=>i.org_id===args[0]&&i.created_by===args[1]&&i.request_key===args[2])];
 if(sql.startsWith('SELECT COALESCE(MAX(version)'))return [[{version:snapshots.length}]];
 if(sql.startsWith('INSERT INTO analytics_snapshots')){const [id,study_id,org_id,version,dataset,content_hash,row_count,created_by]=args;snapshots.push({id,study_id,org_id,version,dataset:JSON.parse(dataset),content_hash,row_count,created_by});return [{affectedRows:1}];}
 if(sql.startsWith('INSERT INTO analytics_source_publications')){const [org_id,created_by,request_key,request_hash,study_id,snapshot_id]=args;receipts.push({org_id,created_by,request_key,request_hash,study_id,snapshot_id});return [{affectedRows:1}];}
 throw Error('Unrecognized test SQL: '+sql);
}
const pool={execute,getConnection:async()=>({execute,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}})};
const db=require.resolve('../../api/database/connection');require.cache[db]={id:db,filename:db,loaded:true,exports:{pool}};
const auth=require.resolve('../../api/middleware/auth');require.cache[auth]={id:auth,filename:auth,loaded:true,exports:(req,res,next)=>{if(!req.headers['x-test-org'])return res.sendStatus(401);req.user={id:Number(req.headers['x-test-user']||1),org_id:req.headers['x-test-org'],role:req.headers['x-test-role']||'manager'};next();}};
const express=require('../../api/node_modules/express'),app=express();app.use(express.json());app.use('/analytics',require('../../api/routes/analytics'));
test('integrated EAM source enforces read group, tenant and study ownership; freezes only reviewed data once',async()=>{
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=(url,{method='GET',body,org='A',user=1,role='manager'}={})=>fetch(`http://127.0.0.1:${server.address().port}/analytics${url}`,{method,headers:{'content-type':'application/json','x-test-org':org,'x-test-user':String(user),'x-test-role':role},body:body?JSON.stringify(body):undefined});
 const root=`/studies/${studyId}/sources/condition`,filter={asset_code:'P-01',metric_code:'temperature',unit:'C',from:'2026-09-01',through:'2026-09-30'};
 try{
  const assets=await (await request('/sources/eam/assets')).json();assert.deepEqual(assets.assets,[{asset_code:'P-01',name:'Bomba'}]);assert(!Object.hasOwn(assets.assets[0],'id'));
  assert.equal((await request('/sources/eam/metrics?asset_code=P-01',{org:'B',role:'superadmin'})).status,404);
  assert.equal((await request(root+'/preview',{method:'POST',body:filter,user:2})).status,404);
  access={eam:{read:false,write:false}};assert.equal((await request(root+'/preview',{method:'POST',body:filter})).status,403);assert.equal((await request('/catalog')).status,200);access={eam:{read:true,write:false}};
  const response=await request(root+'/preview',{method:'POST',body:filter});assert.equal(response.status,200);const preview=await response.json();assert.equal(preview.preview[0].value,0);
  const publish={method:'POST',body:{selection:filter,expected_hash:preview.sha256,request_key:randomUUID()}};
  readings.push({...readings[0],id:2,value:'20.000000'});assert.equal((await request(root+'/publish',publish)).status,409);assert.equal(snapshots.length,0);
  const refreshed=await (await request(root+'/preview',{method:'POST',body:filter})).json();publish.body.expected_hash=refreshed.sha256;assert.equal((await request(root+'/publish',publish)).status,201);assert.equal(snapshots.length,1);assert.equal(snapshots[0].dataset.source,'application-condition');
  readings.push({...readings[0],id:3,value:'30.000000'});const duplicate=await (await request(root+'/publish',publish)).json();assert.equal(duplicate.already_published,true);assert.equal(snapshots.length,1);
  const liveUrl=root+'/live?'+new URLSearchParams(filter);const live=await (await request(liveUrl)).json();assert.equal(live.row_count,3);assert.equal(live.dataset.rows[0].value,0);assert.equal(live.published,false);assert.equal(snapshots[0].row_count,2);assert(!Object.hasOwn(live.dataset.rows[0],'id'));
  assert.equal((await request(liveUrl,{org:'B',role:'superadmin'})).status,404);assert.equal((await request(liveUrl,{user:2})).status,404);assert.equal((await request(liveUrl+'&org_id=A')).status,400);
  access={eam:{read:false,write:false}};assert.equal((await request(liveUrl)).status,403);access={eam:{read:true,write:false}};
  assert.equal((await request(root+'/publish',{...publish,org:'B',role:'superadmin'})).status,404);assert.equal((await request(root+'/publish',{...publish,body:{...publish.body,expected_hash:'f'.repeat(64)}})).status,409);
  assert(calls.some(c=>c.sql.includes('BINARY org_id=BINARY ?')&&c.args[0]==='A'));assert(!calls.some(c=>/^UPDATE (assets|condition_readings)/.test(c.sql)));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
