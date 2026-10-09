const {test}=require('node:test'),assert=require('node:assert/strict');
const {decideAuthorization}=require('../../api/services/material-authorization'),{purchaseSnapshot}=require('../../api/services/purchase-units'),{poissonForecast}=require('../../api/services/poisson'),Calendar=require('../../app/js/maintenance-calendar'),{calculateMrp}=require('../../api/services/mrp-planner');
test('partial authorization preserves issued quantity and revokes remaining balance',()=>{
 const draft={status:'draft',requested_quantity:10,issued_quantity:2};assert.deepEqual(decideAuthorization(draft,'approved',3),{approved:5,status:'approved'});assert.throws(()=>decideAuthorization(draft,'approved',9));assert.deepEqual(decideAuthorization({...draft,status:'approved'},'revoked'),{approved:2,status:'revoked'});assert.throws(()=>decideAuthorization(draft,'revoked'));
 assert.equal(decideAuthorization({status:'draft',requested_quantity:0.3,issued_quantity:0.2},'approved',0.1).approved,0.3);
});
test('purchase quantities and price convert using an immutable snapshot',async()=>{
 const c={execute:async(sql,args)=>{assert(sql.includes('m.org_id=?'));assert.equal(args[1],'tenant-a');return [[{unit:'UN',purchase_unit:'CX',factor:4}]];}};
 assert.deepEqual(await purchaseSnapshot(c,'tenant-a',1,10,20,'CX'),{unit:'CX',factor:4,purchaseQuantity:2.5,baseQuantity:10,basePrice:5,purchasePrice:20});await assert.rejects(()=>purchaseSnapshot(c,'tenant-a',1,10,20,'KG'));assert.equal((await purchaseSnapshot(c,'tenant-a',1,10,20)).factor,1);
});
test('calendar postpones weekends and exceptions and rejects invalid shifts',()=>{
 const c=Calendar.validate({weekdays:[1,2,3,4,5],holidays:['2026-10-05'],start:'08:00',end:'17:00'});assert.equal(Calendar.nextWorking('2026-10-03',c),'2026-10-06');assert.throws(()=>Calendar.validate({...c,start:'17:00',end:'08:00'}));assert.throws(()=>Calendar.validate({...c,holidays:['2026-02-30']}));assert.equal(Calendar.nextWorking('2026-10-03',null),'2026-10-03');
});
test('Poisson probabilities and coverage match known analytical example',()=>{
 const p=poissonForecast(10,100,10);assert.equal(p.expected_failures,1);assert(Math.abs(p.probability_at_least_one-(1-Math.exp(-1)))<1e-12);assert.equal(p.coverage_count,3);assert.equal(poissonForecast(0,100,10).supported,false);assert.throws(()=>poissonForecast(10,0,10));
});
test('same-day demand allocates inbound first and scarce stock by priority',()=>{
 const rows=calculateMrp({materials:[{id:1,code:'A',quantity:3}],forecasts:[{material_id:1,forecast_date:'2026-10-01',quantity:4,priority:'low'},{material_id:1,forecast_date:'2026-10-01',quantity:4,priority:'urgent'}],preventiveDemand:[],reservations:[],inbound:[{material_id:1,expected_at:'2026-10-01',open_quantity:2}],today:'2026-10-01',until:'2026-10-31'});assert.equal(rows[0].timeline[1].type,'purchase_order');assert.equal(rows[0].timeline[2].priority,'urgent');assert.equal(rows[0].timeline[2].allocated_quantity,4);assert.equal(rows[0].timeline[3].uncovered_quantity,3);
});
