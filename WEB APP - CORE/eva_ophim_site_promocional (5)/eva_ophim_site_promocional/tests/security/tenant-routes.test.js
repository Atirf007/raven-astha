const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('../../api/node_modules/express');
const calls = [];
let responder;
const pool = { execute: async (sql, args=[]) => { calls.push({sql,args}); return responder(sql,args); }, query: async (sql,args) => pool.execute(sql,args) };
pool.getConnection = async () => ({...pool, beginTransaction:async()=>{}, commit:async()=>{}, rollback:async()=>{}, release:()=>{}});
require.cache[require.resolve('../../api/database/connection')] = {exports:{pool}};
require.cache[require.resolve('../../api/middleware/auth')] = {exports:(req,res,next)=>{
  if(req.headers['x-anonymous']) return res.sendStatus(401);
  req.user={id:1,org_id:'TENANT_A',role:req.headers['x-role']||'manager'}; next();
}};
const app=express(); app.use(express.json({limit:'16mb'}));
for(const name of ['warehouse','components','material-files']) app.use('/'+name,require('../../api/routes/'+name));
app.use('/org', require('../../api/routes/organizations'));
async function request(url,method='GET',body,headers={}) {
 const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
 try {return await fetch(`http://127.0.0.1:${server.address().port}${url}`,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});} finally {server.close();}
}
test('SEC-TENANT components require authentication',async()=>{
 responder=()=>[[]]; assert.equal((await request('/components','GET',undefined,{'x-anonymous':'yes'})).status,401);
});
test('corporate design cannot be changed by viewers and uses the authenticated organization', async()=>{
 calls.length=0; responder=()=>[{affectedRows:1}];
 const body={org_id:'TENANT_B',cover_image:null,links:[{label:'Slack',url:'https://example.com/slack'}]};
 assert.equal((await request('/org/profile-design','PUT',body,{'x-role':'viewer'})).status,403);
 assert.equal(calls.length,0);
 assert.equal((await request('/org/profile-design','PUT',body,{'x-role':'admin'})).status,200);
 assert.equal(calls[0].args[0],'TENANT_A');
 calls.length=0;
 responder=()=>[[{cover_image:null,links_json:'[]'}]];
 assert.equal((await request('/org/profile-design')).status,200);
 assert.deepEqual(calls[0].args,['TENANT_A']);
});
test('SEC-TENANT viewer cannot mutate warehouse, components or attachments',async()=>{
 responder=()=>[{affectedRows:1,insertId:1}];
 for(const [url,method,body] of [['/warehouse/shelves/2','DELETE'],['/components','POST',{name:'x',materials:[{code:'x',qty:1}]}],['/material-files/files/2','DELETE']]){
 calls.length=0; assert.equal((await request(url,method,body,{'x-role':'viewer'})).status,403); assert.equal(calls.length,0);
 }
});
test('SEC-WEB-001 admin cannot grant or modify superadmin membership', async()=>{
 for (const targetRole of ['viewer','superadmin']) {
  calls.length=0;
  responder=sql=>sql.startsWith('SELECT')?[[{id:2,role:targetRole}]]:[{affectedRows:1}];
  const response=await request('/org/users/2','PUT',{role:'superadmin'},{'x-role':'admin'});
  assert.equal(response.status,403); assert.equal(calls.filter(c=>c.sql.startsWith('UPDATE')).length,0);
 }
});
test('SEC-WEB-001 superadmin can assign canonical roles within its tenant', async()=>{
 responder=sql=>sql.startsWith('SELECT')?[[{id:2,role:'viewer'}]]:[{affectedRows:1}];
 assert.equal((await request('/org/users/2','PUT',{role:'operator'},{'x-role':'superadmin'})).status,200);
 assert.ok(calls.some(c=>c.sql.startsWith('UPDATE')&&c.args.includes('TENANT_A')));
});
test('SEC-WEB-002 chart rejects cross-tenant user and parent references', async()=>{
 for (const body of [{position_id:3,user_id:99},{position_id:3,reports_to:99}]) {
  let selects=0; responder=sql=>sql.startsWith('SELECT')?[selects++===0?[{id:3}]:[]]:[{insertId:1}];
  const response=await request('/org/chart','POST',body,{'x-role':'admin'});
  assert.equal(response.status,400); assert.ok(!calls.some(c=>c.sql.startsWith('INSERT INTO org_chart'))); calls.length=0;
 }
});
test('SEC-WEB-003 viewers cannot create or delete organization events', async()=>{
 responder=()=>[{affectedRows:1,insertId:1}];
 assert.equal((await request('/org/events','POST',{title:'x',date:'2026-09-14'},{'x-role':'viewer'})).status,403);
 assert.equal((await request('/org/events/1','DELETE',undefined,{'x-role':'viewer'})).status,403);
});
test('SEC-TENANT foreign shelf mutation is constrained in SQL',async()=>{
 responder=(sql,args)=>[{affectedRows:sql.includes('org_id')&&args.includes('TENANT_A')?0:1}];
 assert.equal((await request('/warehouse/shelves/99','DELETE')).status,404);
});
test('SEC-TENANT foreign file cannot be downloaded via another material',async()=>{
 responder=(sql,args)=>[sql.includes('org_id')&&args.includes('TENANT_A')&&args.includes('MAT_A')?[]:[{filename:'foreign.pdf',mime_type:'application/pdf',file_data:Buffer.from('%PDF-test').toString('base64')}]];
 assert.equal((await request('/material-files/MAT_A/files/99/data')).status,404);
});
test('SEC-TENANT schema errors do not fall back to global layout',async()=>{
 calls.length=0; responder=(sql)=>{if(sql.includes('org_id'))throw Error('sentinel schema detail');return [[{id:99}]];};
 const response=await request('/warehouse/layout'); assert.equal(response.status,500); assert.equal(calls.length,1);
});
test('MAP-SEC-001 warehouse rejects malformed blueprint before database access',async()=>{
 calls.length=0; responder=()=>{throw new Error('database should not be reached');};
 const response=await request('/warehouse/layout','PUT',{blueprint_data:[]},{'x-role':'manager'});
 assert.equal(response.status,400); assert.equal(calls.length,0);
});
test('MAP-001 warehouse persists the normalized blueprint inside the tenant boundary',async()=>{
 calls.length=0;
 responder=(sql)=>sql.startsWith('SELECT c.layout_id')?[[{layout_id:7}]]:sql.startsWith('SELECT warehouse_id')?[[]]:sql.startsWith('SELECT id FROM warehouse_layout')?[[{id:7}]]:[{affectedRows:1}];
 const blueprint={floors:{0:{machines:[{id:'CNC-1',x:12,y:20,w:40,h:30}],walls:[{id:'W-1',x1:0,y1:0,x2:100,y2:0}]}}};
 const response=await request('/warehouse/layout','PUT',{blueprint_data:blueprint},{'x-role':'manager'});
 assert.equal(response.status,200);
 const update=calls.find(call=>call.sql.startsWith('UPDATE warehouse_layout'));
 assert.ok(update.sql.includes('org_id = ?')); assert.equal(update.args.at(-1),'TENANT_A');
 assert.deepEqual(update.args.slice(0,5),[null,null,null,null,null]);
 const saved=JSON.parse(update.args[6]); assert.equal(saved.schemaVersion,2); assert.equal(saved.floors[0].machines[0].id,'CNC-1');
});
test('MAP-001 partial dimension update preserves the persisted blueprint',async()=>{
 calls.length=0; responder=(sql)=>sql.startsWith('SELECT c.layout_id')?[[{layout_id:7}]]:sql.startsWith('SELECT warehouse_id')?[[]]:sql.startsWith('SELECT id FROM warehouse_layout')?[[{id:7}]]:[{affectedRows:1}];
 assert.equal((await request('/warehouse/layout','PUT',{room_w:900},{'x-role':'manager'})).status,200);
 const update=calls.find(call=>call.sql.startsWith('UPDATE warehouse_layout'));
 assert.equal(update.args[0],900); assert.equal(update.args[6],null); assert.match(update.sql,/blueprint_data = COALESCE\(\?, blueprint_data\)/);
});
test('SEC-TENANT all read paths constrain tenant and preserve own resources',async()=>{
 for(const url of ['/warehouse/assignments','/warehouse/shelves','/warehouse/shelves/1/items','/components','/material-files/MAT_A/files']) {
   calls.length=0;
   responder=(sql,args)=> {if(sql.startsWith('SELECT c.layout_id'))return [[{layout_id:7}]];if(sql.includes('FROM materials WHERE'))return [[{id:1}]];return [[]];};
   assert.equal((await request(url)).status,200);
   assert.ok(calls.some(c=>c.sql.includes('org_id')&&c.args.includes('TENANT_A')),url);
 }
});
test('SEC-TENANT attachment mutations and material lookup deny foreign tenant',async()=>{
 for(const [url,method,body] of [['/material-files/files/99','DELETE'],['/material-files/files/99','PATCH',{description:'test'}],['/material-files/MAT_B/files','POST',{category:'manual',filename:'a.pdf',file_data:'JVBERi0='}]]){
  responder=(sql,args)=>sql.startsWith('SELECT')?[[]]:[{affectedRows:sql.includes('org_id')&&args.includes('TENANT_A')?0:1}];
  assert.equal((await request(url,method,body)).status,404);
 }
});
test('SEC-TENANT assignment rejects foreign material without performing write',async()=>{
 calls.length=0; responder=(sql,args)=>sql.includes('FROM shelves')?[[{shelf_code:'A',levels:4,positions:5}]]:[[]];
 assert.equal((await request('/warehouse/assign','POST',{shelf_id:1,material_id:99,level:1,position:1})).status,404);
 assert.ok(!calls.some(c=>c.sql.includes('INSERT')||c.sql.includes('UPDATE materials')));
});
test('SEC-TENANT legitimate assignment uses both tenant locks and updates location',async()=>{
 calls.length=0; responder=(sql,args)=>sql.includes('FROM shelves')?[[{shelf_code:'A',layout_id:7,levels:4,positions:5}]]:sql.includes('SELECT blueprint_data')?[[{blueprint_data:JSON.stringify({floors:{0:{shelves:[{id:'A',levels:4,positions:5,warehouse_id:1}]}}})}]]:sql.startsWith('SELECT')?[[{id:1,warehouse_id:1,layout_id:7}]]:[{affectedRows:1,insertId:1}];
 assert.equal((await request('/warehouse/assign','POST',{shelf_id:1,material_id:1,level:1,position:1})).status,201);
 assert.equal(calls.filter(c=>c.sql.includes('FOR UPDATE')&&c.sql.includes('org_id')).length,2);
});
test('SEC-TENANT component validates material ownership and successful creation',async()=>{
 for(const foreign of [true,false]) {
 calls.length=0; responder=(sql,args)=>sql.startsWith('SELECT')?(foreign?[[]]:[[{id:1}]]):[{insertId:1}];
 assert.equal((await request('/components','POST',{name:'Assembly',materials:[{code:foreign?'MAT_B':'MAT_A',qty:1}]})).status,foreign?404:201);
 const lookup=calls.find(c=>c.sql.startsWith('SELECT'));assert.ok(lookup.sql.includes('org_id')); assert.ok(lookup.args.includes('TENANT_A'));
 }
});
test('SEC-UPLOAD neutralizes active content and accepts legitimate PDF',async()=>{
 const {validateAttachment,safeUrl,MAX_BYTES}=require('../../api/security/attachments');
 for(const filename of ['attack.html','attack.svg','attack.jpg','../attack.pdf'])assert.throws(()=>validateAttachment({filename,file_data:Buffer.from('<img src=x onerror=alert(1)>').toString('base64')}));
 assert.throws(()=>validateAttachment({filename:'large.pdf',file_data:'A'.repeat(Math.ceil(MAX_BYTES/3)*4+201)}));
 for(const url of ['javascript:alert(1)','data:text/html,test','http://example.invalid/','https://user:secret@example.invalid/'])assert.equal(safeUrl(url),null);
 assert.equal(safeUrl('https://example.invalid/manual.pdf'),'https://example.invalid/manual.pdf');
 assert.equal(validateAttachment({filename:'guide.pdf',file_data:Buffer.from('%PDF-1.7\n%%EOF').toString('base64'),mime_type:'text/html'}).mime_type,'application/pdf');
 responder=sql=>sql.startsWith('SELECT')?[[{id:1}]]:[{insertId:1}];
 assert.equal((await request('/material-files/MAT_A/files','POST',{category:'manual',filename:'guide.pdf',file_data:Buffer.from('%PDF-1.7\n%%EOF').toString('base64')})).status,201);
});
test('SEC-UPLOAD self-contained 3D remains supported and external glTF fetch rejected',()=>{
 const {validateAttachment}=require('../../api/security/attachments');
 for(const [filename,data] of [['part.obj','v 0 0 0\nv 1 1 1'],['part.stl','solid part\nfacet normal 0 0 1\nendsolid part'],['part.gltf',JSON.stringify({asset:{version:'2.0'}})]])assert.ok(validateAttachment({filename,file_data:Buffer.from(data).toString('base64')}));
 assert.throws(()=>validateAttachment({filename:'part.gltf',file_data:Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'https://example.invalid/sentinel'}]})).toString('base64')}));
});
test('SEC-UPLOAD download is isolated and does not trust stored MIME',async()=>{
 responder=()=>[[{filename:'payload.html',mime_type:'text/html',file_data:Buffer.from('<h1>sentinel</h1>').toString('base64')}]];
 const response=await request('/material-files/MAT_A/files/1/data');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
});
