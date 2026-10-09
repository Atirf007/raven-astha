'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {gaussian,normalCdf,normalQuantile,ageHazard,pareto}=require('../../api/services/analytics/statistics');
const {dataset,analysis,restore}=require('../../api/services/analytics/datasets');
const {run}=require('../../api/services/analytics/runner');
const {evidence,csv}=require('../../api/services/analytics/evidence');
const {artifact}=require('../../api/services/analytics/artifacts');
const {inspect}=require('../../api/services/analytics/inspection');
const assumptions={unit:'h',independent_subjects:true,noninformative_censoring:true};
const lives=[{subject_id:'A',duration:10,event:true},{subject_id:'B',duration:20,event:false},{subject_id:'C',duration:20,event:true},{subject_id:'D',duration:40,event:false}];
test('Normal reference matches independent tabulated quantiles and histogram probability mass',()=>{
 assert.equal(normalCdf(0),.5);assert.ok(Math.abs(normalCdf(1.959963984540054)-.975)<1e-9);
 assert.ok(Math.abs(normalQuantile(.975)-1.959963984540054)<1e-8);
 for(const p of [.000125,.01,.25,.75,.99,.999875])assert.ok(Math.abs(normalCdf(normalQuantile(p))-p)<1e-12);
 const result=gaussian([-2,-1,0,1,2,null]);assert.equal(result.valid,5);assert.equal(result.missing,1);assert.equal(result.mean,0);assert.equal(result.standard_deviation,Math.sqrt(2.5));
 assert.equal(result.histogram.reduce((sum,b)=>sum+b.count,0),5);assert.ok(Math.abs(result.histogram.reduce((sum,b)=>sum+b.density*(b.to-b.from),0)-1)<1e-12);
 const area=result.curve.slice(1).reduce((sum,p,i)=>sum+(p.value-result.curve[i].value)*(p.density+result.curve[i].density)/2,0);assert.ok(area>.9999&&area<1.0001);
 assert.equal(result.qq[2].theoretical,0);assert.equal(result.qq[2].observed,0);assert.equal(result.confidence_interval,null);
});
test('Gauss refuses zero dispersion and insufficient observations; Q–Q sampling does not drop observations from statistics',()=>{
 for(const values of [[null,null],[0,0,0],[1,2,null]]){const result=gaussian(values);assert.equal(result.status,'not-estimable');assert.deepEqual(result.curve,[]);}
 const result=gaussian(Array.from({length:4000},(_,i)=>i));assert.equal(result.valid,4000);assert.equal(result.qq.length,200);assert.equal(result.qq[0].rank,1);assert.equal(result.qq.at(-1).rank,4000);assert.equal(result.histogram.reduce((sum,b)=>sum+b.count,0),4000);
 assert.throws(()=>gaussian([0,'1',2]));assert.throws(()=>normalQuantile(0));
});
test('age rates conserve exposure and events at band boundaries, with correct time-unit scaling',()=>{
 const result=ageHazard(lives,{...assumptions,bins:4});assert.equal(result.total_exposure,90);assert.deepEqual(result.bands.map(b=>b.exposure),[40,30,10,10]);assert.deepEqual(result.bands.map(b=>b.events),[1,1,0,0]);assert.deepEqual(result.bands.map(b=>b.censored),[0,1,0,1]);assert.equal(result.bands[0].rate,1/40);assert.equal(result.bands[1].rate,1/30);
 const scaled=ageHazard(lives.map(row=>({...row,duration:row.duration/24})),{...assumptions,unit:'d',bins:4});assert.ok(Math.abs(scaled.total_exposure-90/24)<1e-12);scaled.bands.forEach((b,i)=>assert.ok(Math.abs(b.rate-result.bands[i].rate*24)<1e-12));
 assert.equal(ageHazard(lives.map(row=>({...row,event:false})),{...assumptions,bins:4}).bands[0].rate,0);
 for(const bins of [1,21,2.5])assert.throws(()=>ageHazard(lives,{...assumptions,bins}));assert.throws(()=>ageHazard(lives,{unit:'h',bins:4}));
});
test('observed age rates may show early failures and wearout without imposing a bathtub shape',()=>{
 const rows=Array.from({length:100},(_,i)=>({subject_id:String(i),duration:i<10?1:i<90?10:100,event:i<10||i>=90}));
 const result=ageHazard(rows,{...assumptions,bins:10});assert.ok(result.bands[0].rate>0);assert.equal(result.bands[4].rate,0);assert.ok(result.bands[9].rate>result.bands[0].rate);assert.equal(result.events,20);assert.equal(result.censored,80);
});
test('Pareto aggregates explicit nonnegative weights with deterministic ties and unavailable zero-total shares',()=>{
 const rows=[['B',2],['A',3],['B',1],['C',0]].map(([category,value],i)=>({subject_id:String(i),category,value}));
 const result=pareto(rows,{unit:'occurrences'});assert.deepEqual(result.rows.map(r=>r.category),['A','B','C']);assert.equal(result.total,6);assert.deepEqual(result.rows.map(r=>r.cumulative),[.5,1,1]);
 assert.equal(pareto(rows.map(r=>({...r,value:0})),{unit:'h'}).rows[0].cumulative,null);
 for(const value of [null,-1,NaN,.5])assert.throws(()=>pareto([{subject_id:'a',category:'A',value}],{unit:'occurrences'}));
 assert.throws(()=>pareto(Array.from({length:101},(_,i)=>({subject_id:String(i),category:String(i),value:1})),{unit:'h'}));
});
test('new contracts preserve category text and provenance, reject scripts as parameters and enforce resource bounds',()=>{
 const input={kind:'categories',variable:{name:'Perdas',unit:'BRL'},rows:[{subject_id:'a',category:'<img onerror=bad()>',value:2.5}]},snap=dataset(input);
 assert.equal(restore(snap.data).hash,snap.hash);assert.deepEqual(analysis(snap.data,'pareto/1',{}),{unit:'BRL'});assert.deepEqual(analysis(snap.data,'pareto/1',{unit:'BRL'}),{unit:'BRL'});
 assert.throws(()=>analysis(snap.data,'pareto/1',{unit:'h'}));assert.throws(()=>analysis(snap.data,'pareto/1',{code:'eval()'}));assert.throws(()=>analysis(snap.data,'normal-reference/1',{}));
 assert.throws(()=>dataset({...input,rows:Array.from({length:101},(_,i)=>({subject_id:String(i),category:String(i),value:1}))}));
 const inspection=inspect({dataset:snap.data,content_hash:snap.hash,row_count:1,version:1});assert.equal(inspection.methods.find(m=>m.id==='pareto/1').compatible,true);assert.equal(inspection.methods.find(m=>m.id==='descriptive/1').compatible,false);
});
test('all three methods execute in the bounded real worker and retain evidence and safe CSV output',async()=>{
 const inputs=[['normal-reference/1',{kind:'measurements',variable:{name:'T',unit:'C'},rows:[0,1,2,null].map((value,i)=>({subject_id:String(i),value}))},{}],['age-hazard/1',{kind:'life',variable:{name:'Vida',unit:'h'},rows:lives},{...assumptions,bins:4}],['pareto/1',{kind:'categories',variable:{name:'Perdas',unit:'h'},rows:[{subject_id:'a',category:'=HYPERLINK("x")',value:1.5},{subject_id:'b',category:'Rolamento',value:3}]},{}]];
 for(const [method,input,parameters] of inputs){const snap=dataset(input),output=await run(snap.data,method,parameters);assert.equal(output.result.method,method);const pack=evidence({name:'Sintético',question:'Conferir cálculo'},{id:'s',version:1,dataset:snap.data,content_hash:snap.hash},{method,status:'completed',result:{...output,snapshot_id:'s',snapshot_hash:snap.hash,parameters:analysis(snap.data,method,parameters)}});assert.equal(pack.recipe.method,method);assert.equal(JSON.parse(artifact(pack,{format:'json-summary',identifiers:false}).content).result.method,method);if(method==='pareto/1'){assert.match(csv(snap.data),/'=HYPERLINK/);assert.match(artifact(pack,{format:'csv',identifiers:true,delimiter:';',decimal:'comma'}).content,/'=HYPERLINK/);}}
});
