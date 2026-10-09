'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {weibull2p}=require('../../api/services/analytics/statistics');
const {dataset,analysis}=require('../../api/services/analytics/datasets');
const {run}=require('../../api/services/analytics/runner');
const options={unit:'h',independent_subjects:true,noninformative_censoring:true,single_population:true};
const reference=()=>[...[54,187,216,240,244,335,361,373,375,386].map((duration,i)=>({subject_id:'F'+i,duration,event:true})),...Array.from({length:10},(_,i)=>({subject_id:'C'+i,duration:500,event:false}))];
test('NIST censored Weibull reference matches MLE, likelihood and AIC',()=>{
 const result=weibull2p(reference(),options);assert.equal(result.status,'exploratory');assert.ok(Math.abs(result.shape-1.7208)<.0001);assert.ok(Math.abs(result.scale-606.528)<.001);assert.ok(Math.abs(result.log_likelihood+75.135)<.001);assert.ok(Math.abs(result.aic-154.27)<.002);
 assert.ok(Math.abs(result.convergence.profile_score)<1e-7);assert.ok(result.confidence_interval.shape.lower<result.shape&&result.confidence_interval.shape.upper>result.shape);assert.ok(result.confidence_interval.scale.lower<result.scale);assert.ok(result.b10<result.scale);
 assert.ok(Math.abs(Math.exp(-Math.pow(result.b10/result.scale,result.shape))-.9)<1e-10);
});
test('unit rescaling preserves shape and scales life and its approximate intervals',()=>{
 const a=weibull2p(reference(),options),b=weibull2p(reference().map(row=>({...row,duration:row.duration/24})),{...options,unit:'d'});
 assert.ok(Math.abs(a.shape-b.shape)<1e-8);assert.ok(Math.abs(a.scale/24-b.scale)<1e-8);assert.ok(Math.abs(a.confidence_interval.scale.lower/24-b.confidence_interval.scale.lower)<1e-8);
});
test('reported log-parameter intervals agree with an independent finite-difference likelihood Hessian',()=>{
 const rows=reference(),fit=weibull2p(rows,options),a=Math.log(fit.shape),b=Math.log(fit.scale),h=.0001;
 const likelihood=(logShape,logScale)=>rows.reduce((sum,row)=>{const shape=Math.exp(logShape),logTime=Math.log(row.duration);return sum+(row.event?logShape-shape*logScale+(shape-1)*logTime:0)-Math.exp(shape*(logTime-logScale));},0);
 const center=likelihood(a,b),aa=-(likelihood(a+h,b)-2*center+likelihood(a-h,b))/(h*h),bb=-(likelihood(a,b+h)-2*center+likelihood(a,b-h))/(h*h),ab=-(likelihood(a+h,b+h)-likelihood(a+h,b-h)-likelihood(a-h,b+h)+likelihood(a-h,b-h))/(4*h*h),det=aa*bb-ab*ab;
 const z=1.959963984540054,shapeSe=Math.log(fit.confidence_interval.shape.upper/fit.shape)/z,scaleSe=Math.log(fit.confidence_interval.scale.upper/fit.scale)/z;
 assert.ok(Math.abs(shapeSe-Math.sqrt(bb/det))<1e-6);assert.ok(Math.abs(scaleSe-Math.sqrt(aa/det))<1e-6);
});
test('unsupported populations, repeated lives, too few events and unidentifiable fits are refused',()=>{
 assert.throws(()=>weibull2p(reference(),{...options,single_population:false}));
 assert.throws(()=>weibull2p([...reference(),reference()[0]],options));
 assert.equal(weibull2p(reference().map(row=>({...row,event:false})),options).status,'not-estimable');
 assert.equal(weibull2p(reference().map(row=>({...row,duration:100})),options).status,'not-estimable');
 const small=weibull2p(reference().slice(0,5),options);assert.equal(small.status,'exploratory');assert.equal(small.confidence_interval,null);
});
test('Weibull uses the same bounded runner and explicit method contract as other analyses',async()=>{
 const data=dataset({kind:'life',variable:{name:'Vida do componente',unit:'h'},rows:reference()}).data;
 assert.throws(()=>analysis(data,'weibull-2p-right/1',{independent_subjects:true,noninformative_censoring:true}));
 const params=analysis(data,'weibull-2p-right/1',options),output=await run(data,'weibull-2p-right/1',params);
 assert.equal(output.result.events,10);assert.ok(Math.abs(output.result.scale-606.528)<.001);assert.equal(output.engine.randomness,'none');
});
