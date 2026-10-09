const {test}=require('node:test');
const assert=require('node:assert/strict');
const {dataset,analysis}=require('../../api/services/analytics/datasets');
const {run}=require('../../api/services/analytics/runner');
const input=()=>({kind:'measurements',variable:{name:'Temperatura',unit:'C'},rows:[{subject_id:'A',value:10},{subject_id:'B',value:null},{subject_id:'C',value:20}]});
test('snapshots normalize explicitly and hash semantic metadata as well as observations',()=>{
 const a=dataset(input()),b=dataset({...input(),variable:{unit:'C',name:'Temperatura'}});
 assert.equal(a.hash,b.hash);assert.equal(a.rows,3);assert.equal(a.data.rows[1].value,null);
 const changed=input();changed.variable.unit='F';assert.notEqual(dataset(changed).hash,a.hash);
 assert.throws(()=>dataset({...input(),org_id:'other'}));
 assert.throws(()=>dataset({...input(),rows:[{subject_id:'A',value:'20'}]}));
 assert.throws(()=>dataset({...input(),rows:[{subject_id:'A',value:0},{subject_id:'A',value:1}]}));
 assert.throws(()=>dataset(JSON.parse('{"kind":"measurements","variable":{"name":"x","unit":"C","__proto__":{}},"rows":[]}')));
 assert.throws(()=>analysis(a.data,'eval',{}));
 assert.throws(()=>analysis(a.data,'descriptive/1',{code:'process.exit()'}));
});
test('actual bounded child runner returns scientific output without blocking the HTTP process',async()=>{
 const result=await run(dataset(input()).data,'descriptive/1',{});
 assert.equal(result.schema,'astha-result/1');assert.equal(result.result.mean,15);assert.equal(result.result.missing,1);assert.match(result.runtime,/^v\d/);
 const data=dataset({kind:'life',variable:{name:'Vida',unit:'h'},rows:[{subject_id:'A',duration:10,event:true},{subject_id:'B',duration:20,event:false}]}).data;
 const parameters=analysis(data,'kaplan-meier-right/1',{independent_subjects:true,noninformative_censoring:true});
 const km=await run(data,'kaplan-meier-right/1',parameters);assert.equal(km.result.median,10);assert.equal(km.result.curve[0].survival,0.5);
});
test('runner cancels and enforces its launch deadline',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(run(dataset(input()).data,'descriptive/1',{}, {signal:controller.signal}),/CANCELLED/);
 await assert.rejects(run(dataset(input()).data,'descriptive/1',{}, {timeoutMs:1}),/TIME_LIMIT/);
 const active=new AbortController(),pending=run(dataset(input()).data,'descriptive/1',{}, {signal:active.signal});active.abort();await assert.rejects(pending,/CANCELLED/);
});
