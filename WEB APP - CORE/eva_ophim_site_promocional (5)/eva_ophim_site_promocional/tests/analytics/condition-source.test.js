'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const condition=require('../../api/services/analytics/condition-source'),{restore,analysis}=require('../../api/services/analytics/datasets');
const filter={asset_code:'BOMBA-01',metric_code:'temperature',unit:'C',from:'2026-09-01',through:'2026-09-30'};
const reading={id:1,metric_code:'temperature',value:'0.000000',unit:'C',recorded_at:'2026-09-03 10:00:00',source:'manual'};
test('EAM condition snapshot preserves zero, reading grain, source clock and stable lineage without database IDs',()=>{
 const result=condition.snapshot({name:'Bomba principal'},[reading,{...reading,id:2,value:'25.125000',source:'iot'}],filter,'A');assert.deepEqual(result.data.rows.map(row=>row.value),[0,25.125]);assert.equal(result.data.source,'application-condition');assert.equal(result.data.provenance.grain,'reading');assert.equal(result.data.provenance.clock,'database-wall-time');assert(!result.content.includes('"id":1'));assert.match(result.data.rows[0].subject_id,/^CBM-[a-f0-9]{64}$/);
 const other=condition.snapshot({name:'Bomba principal'},[reading],filter,'B');assert.notEqual(result.data.rows[0].subject_id,other.data.rows[0].subject_id);assert.equal(restore(result.data).hash,result.hash);
 assert.throws(()=>analysis(result.data,'kaplan-meier-right/1',{independent_subjects:true,noninformative_censoring:true}),/incompatível/);
 const corrupt=structuredClone(result.data);corrupt.provenance.records.reverse();assert.throws(()=>restore(corrupt),/divergentes/);
});
test('source adapter refuses calendar rollover, long windows, missing/mixed units and silent decimal precision loss',()=>{
 for(const bad of [{from:'2026-02-30'},{from:'2024-01-01'},{through:'2026-08-31'},{unit:''},{org_id:'B'}])assert.throws(()=>condition.selection({...filter,...bad}));
 assert.throws(()=>condition.snapshot({name:'Bomba'},[],filter,'A'),/Não existem/);
 assert.throws(()=>condition.snapshot({name:'Bomba'},[{...reading,unit:'F'}],filter,'A'),/incompatível/);
 assert.throws(()=>condition.snapshot({name:'Bomba'},Array(4001).fill(reading),filter,'A'),/truncado/);
 assert.throws(()=>condition.decimal('999999999999.999999'),/precisão/);assert.throws(()=>condition.decimal('0;DROP TABLE'),/decimal/);assert.equal(condition.decimal('-0.000000'),-0);
});
test('quarantine cleanup runs bounded batches, avoids overlapping queries and stops cleanly',async()=>{
 const {startImportCleanup}=require('../../api/services/analytics/import-maintenance');let calls=0,release;const sql=[];
 const stop=startImportCleanup({execute:async query=>{sql.push(query);calls++;await new Promise(resolve=>{release=resolve;});}},{intervalMs:5});await new Promise(resolve=>setTimeout(resolve,25));assert.equal(calls,1);assert.match(sql[0],/LIMIT 100/);assert.match(sql[0],/raw_data=NULL/);assert.match(sql[0],/status<>'published'/);stop();release();await new Promise(resolve=>setTimeout(resolve,15));assert.equal(calls,1);
});
