const {test}=require('node:test');
const assert=require('node:assert/strict');
const {filters,insights}=require('../../api/services/stock-insights');
test('invalid dates, reversed ranges and SQL-shaped stock identifiers fail closed',()=>{
 for(const query of [{from:'2026-99-99'},{from:'2026-02-30'},{from:'2026-10-06',to:'2026-10-01'},{warehouses:'1 OR 1=1'},{warehouses:'1,1'},{warehouses:'0'}])assert.throws(()=>filters(query),e=>e.status===400);
});
test('foreign stock selection cannot reach aggregate queries',async()=>{
 let calls=0;const db={execute:async(sql,args)=>{calls++;assert.deepEqual(args,['ORG_A']);return [[{id:1}]];}};
 await assert.rejects(insights(db,'ORG_A',{warehouses:'2'}),e=>e.status===404);assert.equal(calls,1);
});
test('all aggregate queries bind tenant, stock and period values',async()=>{
 const calls=[];const db={execute:async(sql,args)=>{calls.push({sql,args});if(calls.length===1)return [[{id:1}]];if(sql.includes('COUNT(*) AS materials,COALESCE'))return [[{materials:2}]];return [[]];}};
 const data=await insights(db,'ORG_A',{warehouses:'1',from:'2026-10-01',to:'2026-10-06'});
 assert.equal(data.summary.materials,2);assert.equal(calls.length,8);
 for(const call of calls.slice(1)){assert.equal(call.args[0],'ORG_A');assert.equal(call.args[1],1);assert.ok(!call.sql.includes('ORG_A'));}
});
