const {test}=require('node:test');
const assert=require('node:assert/strict');
const {descriptive,kaplanMeier}=require('../../api/services/analytics/statistics');
const options={unit:'h',independent_subjects:true,noninformative_censoring:true};
const episodes=rows=>rows.map(([duration,event],i)=>({subject_id:String(i),duration,event}));
test('descriptive sample, missingness, tied ECDF and quantiles match manual arithmetic',()=>{
 const result=descriptive([1,2,2,5,null]);
 assert.equal(result.total,5);assert.equal(result.valid,4);assert.equal(result.missing,1);
 assert.equal(result.mean,2.5);assert(Math.abs(result.variance-3)<1e-12);assert.equal(result.median,2);
 assert.equal(result.q1,1.75);assert.equal(result.q3,2.75);
 assert.deepEqual(result.ecdf,[{value:1,probability:0.25},{value:2,probability:0.75},{value:5,probability:1}]);
 assert.equal(descriptive([null]).mean,null);assert.equal(descriptive([1]).variance,null);
 for(const input of [['2'],[''],[NaN],[Infinity]])assert.throws(()=>descriptive(input));
});
test('NIST twenty-unit reference reproduces risk sets and product-limit estimates',()=>{
 const rows=episodes([[10,true],[32,true],[56,true],[98,true],[122,true],[181,true],[50,false],[100,false],[125,false],[150,false],...Array.from({length:10},()=>[200,false])]);
 const result=kaplanMeier(rows,options),events=result.curve.filter(row=>row.events);
 assert.deepEqual(events.map(row=>row.at_risk),[20,19,17,16,14,11]);
 const factors=[19/20,18/19,16/17,15/16,13/14,10/11];let expected=1;
 for(let i=0;i<factors.length;i++){expected*=factors[i];assert(Math.abs(events[i].survival-expected)<1e-12);}
 assert.equal(result.median,null);assert.equal(result.median_status,'not-reached');
});
test('ties process events before withdrawals; unit scaling preserves survival',()=>{
 const rows=episodes([[1,true],[1,false],[2,true],[3,false]]),result=kaplanMeier(rows,options);
 assert.equal(result.curve[0].at_risk,4);assert.equal(result.curve[0].survival,0.75);
 assert.equal(result.curve[1].survival,0.375);assert.equal(result.median,2);
 const scaled=kaplanMeier(rows.map(row=>({...row,duration:row.duration*24})),options);
 assert.deepEqual(scaled.curve.map(row=>row.survival),result.curve.map(row=>row.survival));
 assert.equal(scaled.median,48);
});
test('zero events and total failure do not fabricate finite medians or boundary confidence',()=>{
 const censored=kaplanMeier(episodes([[1,false],[2,false]]),options);
 assert.equal(censored.events,0);assert.equal(censored.median,null);assert.equal(censored.curve[0].confidence_interval,null);
 const failed=kaplanMeier(episodes([[1,true]]),options);
 assert.equal(failed.curve[0].survival,0);assert.equal(failed.curve[0].confidence_interval,null);
 assert.throws(()=>kaplanMeier([{subject_id:'a',duration:1,event:true},{subject_id:'a',duration:2,event:false}],options));
 assert.throws(()=>kaplanMeier(episodes([[1,true]]),{}));
 assert.throws(()=>kaplanMeier([{subject_id:'a',duration:1,event:null}],options));
 assert.throws(()=>kaplanMeier([{subject_id:'a',duration:1,event:true,entry_age:0}],options));
});
