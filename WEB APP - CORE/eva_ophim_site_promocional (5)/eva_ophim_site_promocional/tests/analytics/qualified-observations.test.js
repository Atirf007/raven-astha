'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {input,report}=require('../../api/services/qualified-observations');
const at=h=>new Date(Date.UTC(2026,8,1)+h*3600000).toISOString();
test('qualified input has a closed contract, UTC chronology and explicit evidence',()=>{
 const b={request_key:randomUUID(),kind:'operation',started_at:at(0),ended_at:at(8),source:'Registro de teste',notes:'Observação hipotética',confirmed:true};assert.equal(input(b).dates.length,4);assert.equal(input(b).dates[0],'2026-09-01 00:00:00.000');assert.equal(input(b).hash,input({...b}).hash);
 for(const change of [{confirmed:false},{ended_at:at(0)},{started_at:'2026-09-01T00:00:00'},{started_at:'2026-02-30T00:00:00Z'},{repair_started_at:at(1)},{execute:'sql'}])assert.throws(()=>input({...b,...change}));
 const failure={...b,kind:'failure',repair_started_at:at(2),repair_ended_at:at(6)};assert.equal(input(failure).record.repair_ended_at,at(6));assert.throws(()=>input({...failure,repair_ended_at:at(9)}));assert.throws(()=>input({...b,ended_at:new Date(Date.now()+86400000).toISOString()}));
});
test('qualified repair separates waiting and unions duplicate legacy outage without counting twice',()=>{
 const observations=[{kind:'operation',started_at:at(0),ended_at:at(8)},{kind:'failure',started_at:at(8),ended_at:at(12),repair_started_at:at(9),repair_ended_at:at(11)},{kind:'operation',started_at:at(12),ended_at:at(24)}];
 const r=report({from:at(0),to:at(24),observations,rows:[{started_at:at(8),ended_at:at(12),type:'corrective',work_order_id:1,production_loss_cost:40}]});assert.equal(r.failures,1);assert.equal(r.downtime_hours,4);assert.equal(r.mtbf_hours,20);assert.equal(r.mttr_hours,2);assert.equal(r.exposure.unknown_hours,0);assert.equal(r.availability,20/24);assert.equal(r.production_loss_cost,40);
});
test('missing coverage, no events, period-edge repairs and conflicts keep unavailable estimates null',()=>{
 const failure={kind:'failure',started_at:at(8),ended_at:at(12),repair_started_at:at(9),repair_ended_at:at(11)};
 const r=report({from:at(0),to:at(24),observations:[failure]});assert.equal(r.mtbf_hours,null);assert.equal(r.availability,null);assert.equal(r.mttr_hours,2);assert.equal(report({from:at(0),to:at(10),observations:[failure]}).mttr_hours,null);
 const operation={kind:'operation',started_at:at(0),ended_at:at(24)};assert.equal(report({from:at(0),to:at(24),observations:[operation]}).mtbf_hours,null);const conflict=report({from:at(0),to:at(24),observations:[operation,failure]});assert.equal(conflict.exposure.conflicting_hours,4);assert.equal(conflict.mtbf_hours,null);assert.equal(report({from:at(0),to:at(24)}).failures,null);
});
