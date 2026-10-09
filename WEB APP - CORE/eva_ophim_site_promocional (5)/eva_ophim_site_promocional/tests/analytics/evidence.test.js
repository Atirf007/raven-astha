'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {dataset}=require('../../api/services/analytics/datasets');
const {run}=require('../../api/services/analytics/runner');
const {evidence,canonical,hash,csv}=require('../../api/services/analytics/evidence');
test('evidence bundles freeze data, recipe and engine, and reproduce the original result',async()=>{
 const snap=dataset({kind:'measurements',variable:{name:'T',unit:'C'},rows:[{subject_id:'a',value:10},{subject_id:'b',value:null},{subject_id:'c',value:20}]});
 const output=await run(snap.data,'descriptive/1',{}),job={method:'descriptive/1',status:'completed',result:{...output,snapshot_id:'s',snapshot_hash:snap.hash,parameters:{}}};
 const pack=evidence({name:'Estudo',question:'Pergunta'},{id:'s',version:1,dataset:snap.data,content_hash:snap.hash},job);
 const {manifest,...payload}=pack;assert.equal(manifest.payload_sha256,hash(canonical(payload)));assert.equal(pack.recipe.engine.files.length,2);assert.equal(pack.recipe.engine.dependencies.length,0);
 assert.deepEqual((await run(pack.snapshot.dataset,pack.recipe.method,pack.recipe.parameters)).result,output.result);
 const tampered=structuredClone(snap.data);tampered.rows[0].value=100;assert.throws(()=>evidence({},{id:'s',version:1,dataset:tampered,content_hash:snap.hash},job),/INTEGRITY/);
 assert.equal(canonical({z:2,a:[{b:1,a:0}]}),canonical({a:[{a:0,b:1}],z:2}));
 const reviewed=evidence({name:'Estudo',question:'Pergunta'},{id:'s',version:1,dataset:snap.data,content_hash:snap.hash},job,[{decision:'accepted',note:'Conferido',reviewer_name:'Revisor',created_at:new Date('2026-09-30T12:00:00Z'),result_hash:pack.result_sha256}]);
 const serialized=JSON.parse(JSON.stringify(reviewed)),{manifest:m,...p}=serialized;assert.equal(m.payload_sha256,hash(canonical(p)));
 assert.throws(()=>evidence({},{id:'s',version:1,dataset:snap.data,content_hash:snap.hash},job,[{result_hash:'other'}]),/INTEGRITY/);
});
test('CSV neutralizes string formulas, preserves negative numbers and distinguishes missing values',()=>{
 const text=csv({kind:'measurements',rows:[{subject_id:' =HYPERLINK("x")',value:-2},{subject_id:'@SUM(1)',value:null},{subject_id:'safe,quoted"',value:0}]});
 assert.match(text,/"' =HYPERLINK/);assert.match(text,/"'@SUM/);assert.match(text,/"-2"/);assert.match(text,/"safe,quoted"""/);assert.match(text,/"'@SUM\(1\)",\r\n/);
});
