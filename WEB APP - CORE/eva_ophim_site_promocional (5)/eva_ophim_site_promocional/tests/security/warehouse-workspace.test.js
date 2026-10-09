const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('../../api/node_modules/express');
const service=require('../../api/services/warehouse-context');
const {validateBlueprint}=require('../../api/security/blueprint');
let reply,calls=[];
const pool={execute:async(sql,args=[])=>{calls.push({sql,args});return reply(sql,args);}};
pool.getConnection=async()=>({...pool,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}});
require.cache[require.resolve('../../api/database/connection')]={exports:{pool}};
require.cache[require.resolve('../../api/middleware/auth')]={exports:(req,res,next)=>{if(req.headers['x-anonymous'])return res.sendStatus(401);req.user={id:1,org_id:'ORG_A',role:req.headers['x-role']||'admin'};next();}};
const app=express();app.use(express.json());app.use('/warehouse',require('../../api/routes/warehouse'));
async function request(url,body,headers={},method=body?'POST':'GET'){
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{const res=await fetch(`http://127.0.0.1:${server.address().port}/warehouse${url}`,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json().catch(()=>null)};}finally{server.close();}
}
test('warehouse and shelf reads require authentication; viewers cannot create stocks',async()=>{
 calls=[];assert.equal((await request('/tabs',null,{'x-anonymous':'yes'})).status,401);
 assert.equal((await request('/tabs',{name:'Stock'},{'x-role':'viewer'})).status,403);assert.equal(calls.length,0);
});
test('missing organization warehouse stays empty and layout read never creates one',async()=>{
 calls=[];reply=()=>[[]];assert.equal((await request('/layout')).status,409);assert.ok(calls.every(call=>call.sql.startsWith('SELECT')));
});
test('foreign warehouse and SQL-shaped identifiers cannot expose shelf positions',async()=>{
 reply=()=>[[]];assert.equal((await request('/positions?warehouse_id=99')).status,404);
 calls=[];assert.equal((await request('/positions?warehouse_id=1%20OR%201=1')).status,400);assert.equal(calls.length,0);
});
test('foreign branch, parent and map are rejected without inserting warehouse',async()=>{
 for(const extra of [{org_unit_id:99},{parent_id:99},{layout_id:99}]){
  calls=[];reply=()=>[[]];const result=await request('/tabs',{name:'Stock',...extra});assert.equal(result.status,404);assert.ok(!calls.some(call=>call.sql.startsWith('INSERT')));
 }
});
test('substock inherits map and branch from its owned parent',async()=>{
 calls=[];reply=(sql)=>{
  if(sql.includes('SELECT w.id,w.name'))return [[{id:7,layout_id:11,org_unit_id:5}]];
  if(sql.includes('SELECT id FROM org_units'))return [[{id:5}]];
  if(sql.includes('MAX(tab_number)'))return [[{next_number:3}]];
  if(sql.startsWith('INSERT INTO warehouses'))return [{insertId:8}];return [[]];
 };
 const result=await request('/tabs',{name:'Spare parts',parent_id:7,org_unit_id:999});assert.equal(result.status,201);assert.equal(result.data.layout_id,11);assert.equal(result.data.org_unit_id,5);
 const insert=calls.find(call=>call.sql.startsWith('INSERT INTO warehouse_context'));assert.deepEqual(insert.args,[8,'ORG_A',11,5,7]);assert.ok(!calls.some(call=>call.sql.startsWith('INSERT INTO warehouse_layout')));
});
test('saved shelf positions are restricted to the stock and actual levels',async()=>{
 const blueprint={floors:{0:{shelves:[{id:'A',levels:2,positions:3,warehouse_id:7},{id:'B',levels:1,positions:1,warehouse_id:8},{id:'C',visible:false}]}}};
 const db={execute:async(sql,args)=>{assert.equal(args.at(-1),'ORG_A');return sql.includes('SELECT w.id')?[[{id:7,layout_id:11}]]:[[{blueprint_data:JSON.stringify(blueprint)}]];}};
 assert.deepEqual((await service.positions(db,'ORG_A',7)).map(shelf=>shelf.code),['A']);
 assert.equal(await service.validatePosition(db,'ORG_A',7,'A-N2-P3'),'A-N2-P3');
 for(const slot of ['B-N1-P1','A-N3-P1','A-N1-P4','A-N0-P0'])await assert.rejects(service.validatePosition(db,'ORG_A',7,slot),{status:400});
 assert.equal(await service.validatePosition(db,'ORG_A',7,null),null);
});
test('duplicate shelf codes cannot create ambiguous positions across floors',()=>{
 assert.throws(()=>validateBlueprint({floors:{0:{shelves:[{id:'A'}]},1:{shelves:[{id:'A'}]}}}),/código único/);
});
test('legacy shelves without stock belong only to the original warehouse',async()=>{
 const db={execute:async(sql,args)=>{
  if(sql.includes('SELECT w.id'))return [[{id:args[0],layout_id:11}]];
  if(sql.startsWith('SELECT warehouse_id'))return [[{warehouse_id:7}]];
  return [[{blueprint_data:JSON.stringify({floors:{0:{shelves:[{id:'LEGACY',levels:2,positions:2}]}}})}]];
 }};
 assert.deepEqual((await service.positions(db,'ORG_A',7)).map(shelf=>shelf.code),['LEGACY']);
 assert.deepEqual(await service.positions(db,'ORG_A',8),[]);
});
test('client cannot overwrite canonical CAD maps through the reference-map endpoint',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{const res=await fetch(`http://127.0.0.1:${server.address().port}/warehouse/map-hub`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({maps:[{id:'cad-11',source:'cad'}]})});assert.equal(res.status,400);}finally{server.close();}
});

test('map archive enforces role and tenant ownership; invalid cover rejected',async()=>{
 calls=[];reply=()=>[[]];
 assert.equal((await request('/maps/1',null,{'x-role':'viewer'},'DELETE')).status,403);
 assert.equal(calls.length,0);
 assert.equal((await request('/maps/999',null,{},'DELETE')).status,404);
 assert.deepEqual(calls[0].args,[999,'ORG_A']);assert.ok(calls.every(c=>c.sql.startsWith('SELECT')));
 assert.equal((await request('/tabs',{name:'Invalid cover',cover_image:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
});
