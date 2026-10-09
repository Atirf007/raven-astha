const { test } = require('node:test');
const assert = require('node:assert/strict');
const { exposureLedger, legacyDowntimeReport } = require('../../api/services/analytics/exposure');
const at = hour => `2026-09-01T${String(hour).padStart(2,'0')}:00:00Z`;
const interval = (a,b) => ({started_at:at(a),ended_at:at(b)});
test('overlapping stops are clipped and counted once; unobserved time stays unknown',()=>{
  const result=exposureLedger({from:at(8),to:at(12),downtime:[interval(7,10),interval(9,11)]});
  assert.equal(result.downtime_hours,3);assert.equal(result.unknown_hours,1);
  assert.equal(result.calendar_availability,0.25);assert.equal(result.availability,null);
  assert.deepEqual(result.intervals,[{started_at:at(8).replace('Z','.000Z'),ended_at:at(11).replace('Z','.000Z')}]);
});
test('operation conflicting with downtime prevents an operational availability estimate',()=>{
  const result=exposureLedger({from:at(8),to:at(12),downtime:[interval(9,11)],operationIntervals:[interval(8,10)]});
  assert.equal(result.conflicting_hours,1);assert.equal(result.unknown_hours,1);assert.equal(result.availability,null);
});
test('adjacent intervals, open stops, and order count are distinct from qualified failures',()=>{
  const report=legacyDowntimeReport({from:at(8),to:at(12),rows:[
    {...interval(8,9),type:'corrective',work_order_id:3,production_loss_cost:'10'},
    {...interval(9,10),type:'corrective',work_order_id:3,production_loss_cost:'10'},
    {...interval(11,12),ended_at:null,type:'preventive',work_order_id:4}
  ]});
  assert.equal(report.downtime_hours,3);assert.equal(report.corrective_orders,1);
  assert.equal(report.failures,null);assert.equal(report.mtbf_hours,null);assert.equal(report.mttr_hours,null);
  assert.equal(report.production_loss_cost,20);
});
test('invalid intervals are rejected and proportional cost follows the clipped window',()=>{
  assert.throws(()=>exposureLedger({from:at(8),to:at(12),downtime:[interval(10,9)]}));
  assert.throws(()=>exposureLedger({from:at(8),to:at(8)}));
  assert.equal(exposureLedger({from:at(8),to:at(10),downtime:[{started_at:at(11),ended_at:null}]}).downtime_hours,0);
  const report=legacyDowntimeReport({from:at(8),to:at(10),rows:[{...interval(7,9),production_loss_cost:40}]});
  assert.equal(report.production_loss_cost,20);assert.equal(report.corrective_orders,0);
});
