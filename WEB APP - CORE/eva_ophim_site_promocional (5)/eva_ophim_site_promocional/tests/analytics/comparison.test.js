'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {dataset}=require('../../api/services/analytics/datasets');
const {compare}=require('../../api/services/analytics/comparison');
function frozen(rows,version=1,unit='C',kind='measurements'){const data=dataset({kind,variable:{name:'Temperatura',unit},rows});return {id:randomUUID(),version,row_count:data.rows,content_hash:data.hash,dataset:data.data};}
test('comparison preserves zero/null, exact text identities and immutable versions without converting changed units',()=>{
 const a=frozen([{subject_id:'001',value:0},{subject_id:'A',value:null},{subject_id:'B',value:10},{subject_id:'C',value:30}]);
 const b=frozen([{subject_id:'001',value:null},{subject_id:'A',value:null},{subject_id:'B',value:10},{subject_id:'D',value:40}],2,'F');
 const original=JSON.stringify([a,b]),result=compare(a,b);assert.deepEqual(result.summary,{added:1,removed:1,changed:1,unchanged:2});assert.deepEqual(result.changes.map(c=>c.subject_id),['001','C','D']);assert.equal(result.changes[0].before.value,0);assert.equal(result.changes[0].after.value,null);assert.equal(result.metadata_changes[0].field,'variable');assert.equal(result.after.variable.unit,'F');assert.equal(JSON.stringify([a,b]),original);assert(result.limitations.some(text=>text.includes('Não há conversão')));
});
test('comparison verifies integrity, refuses incompatible grain and paginates every difference without silent truncation',()=>{
 const a=frozen(Array.from({length:220},(_,i)=>({subject_id:'S-'+String(i).padStart(3,'0'),value:i}))),b=frozen(a.dataset.rows.map(row=>({...row,value:row.value+1})),2);
 const first=compare(a,b),second=compare(a,b,first.next_cursor),third=compare(a,b,second.next_cursor);assert.equal(first.total_changes,220);assert.equal(first.changes.length,100);assert.equal(third.changes.length,20);assert.equal(third.has_more,false);assert.equal(new Set([...first.changes,...second.changes,...third.changes].map(c=>c.subject_id)).size,220);
 assert.throws(()=>compare(a,{...b,content_hash:'a'.repeat(64)}),/INTEGRITY/);assert.throws(()=>compare(a,{...b,row_count:219}),/INTEGRITY/);assert.throws(()=>compare(a,b,221),/Página/);
 const life=frozen([{subject_id:'A',duration:10,event:false}],3,'h','life');assert.throws(()=>compare(a,life),/Grãos/);
});
test('life comparison records changed censoring explicitly and does not mutate scientific outcomes',()=>{
 const a=frozen([{subject_id:'A',duration:10,event:false}],1,'h','life'),b=frozen([{subject_id:'A',duration:10,event:true}],2,'h','life');assert.equal(compare(a,b).changes[0].after.event,true);assert.equal(a.dataset.rows[0].event,false);
});
test('comparison exposes a changed EAM source record even when its measured value did not change',()=>{
 const condition=require('../../api/services/analytics/condition-source'),filter=condition.selection({asset_code:'A-1',metric_code:'temperature',unit:'C',from:'2026-09-01',through:'2026-09-30'});
 const record={id:1,metric_code:'temperature',unit:'C',value:'0.000000',recorded_at:'2026-09-01 08:00:00',source:'manual'};
 function version(source,number){const normalized=condition.snapshot({name:'Pump'},[{...record,source}],filter,'A');return {id:randomUUID(),version:number,row_count:normalized.rows,content_hash:normalized.hash,dataset:normalized.data};}
 const a=version('manual',1),b=version('inspection',2),result=compare(a,b);assert.equal(result.summary.changed,1);assert.equal(result.changes[0].before.value,0);assert.equal(result.changes[0].after.value,0);assert.equal(result.changes[0].origin_before.source,'manual');assert.equal(result.changes[0].origin_after.source,'inspection');assert(!Object.hasOwn(result.changes[0].origin_before,'id'));
});
