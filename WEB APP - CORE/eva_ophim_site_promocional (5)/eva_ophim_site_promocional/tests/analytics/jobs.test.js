'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createProcessor}=require('../../api/services/analytics/jobs');
const {dataset}=require('../../api/services/analytics/datasets');
function fixture(overrides={}){
 const snapshot=dataset({kind:'measurements',variable:{name:'Temperatura',unit:'C'},rows:[{subject_id:'A',value:20}]});
 const job={id:'job',org_id:'tenant',study_id:'study',snapshot_id:'snapshot',created_by:1,study_owner:1,is_active:1,role:'manager',method:'descriptive/1',parameters:{},dataset:snapshot.data,content_hash:snapshot.hash,...overrides};
 const state={status:'queued',token:null,result:null,code:null,claimed:false,valid:true,queries:[]};
 async function execute(sql,args=[]){
  state.queries.push(sql);
  if(sql.startsWith('SELECT j.*,s.dataset')){if(state.claimed)return[[]];state.claimed=true;return[[job]];}
  if(sql.includes("attempts=attempts+1")){state.status='running';state.token=args[0];}
  if(sql.startsWith('SELECT j.id'))return[state.valid&&state.status==='running'? [{id:job.id}]:[]];
  if(sql.includes("SET j.status='completed'")){assert.match(sql,/lease_expires_at>NOW/);assert.match(sql,/u.is_active=1/);if(state.status==='running'&&state.valid&&state.token===args[3]){state.status='completed';state.result=JSON.parse(args[0]);}}
  if(sql.includes("error_code='ACCESS_REVOKED'")){state.status='failed';state.code='ACCESS_REVOKED';}
  if(sql.includes('error_code=?')){if(state.status==='running'&&state.token===args[3]){state.status='failed';state.code=args[0];}}
  return[{affectedRows:1}];
 }
 const connection={execute,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}};
 return {state,job,pool:{execute,getConnection:async()=>connection}};
}
test('processor verifies snapshot and binds scientific result to its frozen metadata',async()=>{
 const f=fixture();let calls=0;
 const processor=createProcessor(f.pool,async(data,method,parameters)=>{calls++;assert.equal(data.rows[0].value,20);return{schema:'astha-result/1',method,runtime:process.version,result:{mean:20}};});
 await processor.tick();assert.equal(calls,1);assert.equal(f.state.status,'completed');assert.equal(f.state.result.snapshot_hash,f.job.content_hash);assert.equal(f.state.result.variable.unit,'C');
 assert.ok(f.state.queries.some(q=>q.includes('FOR UPDATE')));assert.ok(f.state.queries.some(q=>q.includes('ATTEMPTS_EXHAUSTED')));
});
test('revoked access and corrupted snapshots never execute a calculation',async()=>{
 for(const [overrides,code] of [[{is_active:0},'ACCESS_REVOKED'],[{role:'manager',study_owner:2},'ACCESS_REVOKED'],[{content_hash:'invalid'},'SNAPSHOT_INTEGRITY']]){
  const f=fixture(overrides);let calls=0;await createProcessor(f.pool,async()=>{calls++;}).tick();assert.equal(calls,0);assert.equal(f.state.code,code);
 }
});
test('cancellation and stale lease fence results even when executor returns late',async()=>{
 for(const invalidate of [state=>state.status='cancelled',state=>state.token='new-attempt',state=>state.valid=false]){
  const f=fixture();await createProcessor(f.pool,async()=>{invalidate(f.state);return{result:{mean:999}};}).tick();assert.equal(f.state.result,null);
 }
});
test('processor does not execute concurrently and shutdown aborts active work',async()=>{
 const f=fixture();let entered,release,calls=0;
 const started=new Promise(resolve=>entered=resolve);
 const processor=createProcessor(f.pool,async(_data,_method,_params,{signal})=>{calls++;entered();return new Promise((resolve,reject)=>{release=resolve;signal.addEventListener('abort',()=>reject(Error('CANCELLED')),{once:true});});});
 const stop=processor.start();await started;await processor.tick();assert.equal(calls,1);stop();release({result:{mean:999}});
 await new Promise(resolve=>setImmediate(resolve));await processor.tick();assert.equal(calls,1);assert.equal(f.state.result,null);assert.equal(f.state.code,'CANCELLED');
});
