'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{randomUUID}=require('node:crypto');
const {dataset}=require('../../api/services/analytics/datasets');
const studyId=randomUUID(),foreignId=randomUUID(),snapshotId=randomUUID(),nextId=randomUUID(),otherId=randomUUID(),data=dataset({kind:'measurements',variable:{name:'Valor',unit:'C'},rows:[{subject_id:'A',value:0}]});
const versions=[{id:snapshotId,study_id:studyId,org_id:'A',version:1,dataset:data.content,content_hash:data.hash,row_count:1},{id:nextId,study_id:studyId,org_id:'A',version:2,dataset:data.content,content_hash:data.hash,row_count:1},{id:otherId,study_id:foreignId,org_id:'B',version:1,dataset:data.content,content_hash:data.hash,row_count:1}],calls=[];
const pool={execute:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('SELECT id,name,question'))return [args[0]===studyId&&args[1]==='A'&&(args[2]===1||args[3])?[{id:studyId}]:[]];if(sql.startsWith('SELECT id,version,dataset'))return [versions.filter(row=>row.study_id===args[0]&&row.org_id===args[1]&&[args[2],args[3]].includes(row.id))];throw Error('Unexpected SQL');}};
const db=require.resolve('../../api/database/connection');require.cache[db]={id:db,filename:db,loaded:true,exports:{pool}};
const auth=require.resolve('../../api/middleware/auth');require.cache[auth]={id:auth,filename:auth,loaded:true,exports:(req,res,next)=>{if(!req.headers['x-test-org'])return res.sendStatus(401);req.user={id:Number(req.headers['x-test-user']||1),org_id:req.headers['x-test-org'],role:req.headers['x-test-role']||'manager'};next();}};
const express=require('../../api/node_modules/express'),app=express();app.use('/analytics',require('../../api/routes/analytics'));
test('version comparison requires live route role, study ownership and two tenant snapshots; invalid cursors never reach SQL',async()=>{
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=(query,headers={'x-test-org':'A'})=>fetch(`http://127.0.0.1:${server.address().port}/analytics/studies/${studyId}/comparison?${query}`,{headers});const pair=`from=${snapshotId}&to=${nextId}`;
 try{
  assert.equal((await request(pair,{})).status,401);assert.equal((await request(pair,{'x-test-org':'A','x-test-role':'viewer'})).status,403);assert.equal((await request(pair,{'x-test-org':'B','x-test-role':'superadmin'})).status,404);assert.equal((await request(pair,{'x-test-org':'A','x-test-user':'2'})).status,404);
  const allowed=await request(pair);assert.equal(allowed.status,200);assert.equal((await allowed.json()).summary.unchanged,1);assert.equal((await request(`from=${snapshotId}&to=${otherId}`)).status,404);
  const count=calls.length;assert.equal((await request(pair+'&after=0%20OR%201=1')).status,400);assert.equal(calls.length,count);assert.equal((await request(pair+'&org_id=B')).status,400);assert(calls.every(call=>call.sql.startsWith('SELECT')));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
