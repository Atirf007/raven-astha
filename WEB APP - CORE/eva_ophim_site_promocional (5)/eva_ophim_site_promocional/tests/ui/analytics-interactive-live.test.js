'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('../../js/node_modules/jsdom'),math=require('../../api/services/analytics/statistics');
const root=path.join(__dirname,'../..'),flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(html='<main></main>'){
 const dom=new JSDOM(html,{url:'https://astha.test/app/analytics.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;for(const file of ['api/services/analytics/statistics.js','app/js/analytics-explore.js','app/js/analytics-charts.js','app/js/analytics-live.js','app/js/analytics-curves.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 return {dom,w,d:w.document,host:w.document.querySelector('main')};
}
const measurement={kind:'measurements',variable:{name:'Medição',unit:'mm'},rows:[0,2,4,6,8,null].map((value,i)=>({subject_id:'S'+i,value}))};
const lives=Array.from({length:18},(_,i)=>({subject_id:'L'+i,duration:10+i*3,event:i%4!==0}));
test('browser uses the exact worker mathematics for all six supported methods',()=>{
 const {w}=setup();const vectors=[['descriptive',[measurement.rows.map(r=>r.value)]],['gaussian',[measurement.rows.map(r=>r.value)]],['kaplanMeier',[lives,{unit:'h',independent_subjects:true,noninformative_censoring:true}]],['weibull2p',[lives,{unit:'h',independent_subjects:true,noninformative_censoring:true,single_population:true}]],['ageHazard',[lives,{unit:'h',bins:3,independent_subjects:true,noninformative_censoring:true}]],['pareto',[[{subject_id:'P',category:'Zero',value:0}],{unit:'h'}]]];
 for(const [name,args] of vectors)assert.deepEqual(JSON.parse(JSON.stringify(w.AsthaStatistics[name](...args))),math[name](...args));w.close();
});
test('Pareto selection links all underlying rows, keyboard works, hostile category is inert, clear restores rows',()=>{
 const {w,host}=setup(),data={kind:'categories',variable:{name:'Perdas',unit:'h'},rows:[{subject_id:'A',category:'Rolamento',value:14},{subject_id:'B',category:'Rolamento',value:2},{subject_id:'C',category:'<img src=x onerror=attack()>',value:3}]};
 w.AnalyticsCharts.render(host,math.pareto(data.rows,{unit:'h'}),data.variable,{dataset:data});const bar=host.querySelector('rect[role=button]');bar.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 assert.equal(host.querySelectorAll('.analytics-linked-records tbody tr').length,2);assert.match(host.querySelector('.analytics-linked-records').textContent,/16 h/);assert.equal(host.querySelectorAll('img').length,0);
 [...host.querySelectorAll('button')].find(n=>n.textContent==='Limpar seleção').click();assert.equal(host.querySelectorAll('.analytics-linked-records tbody tr').length,3);
 const toggle=[...host.querySelectorAll('button')].find(n=>n.textContent.toLowerCase().includes('acumulado'));assert.ok(toggle);toggle.click();assert.equal(toggle.getAttribute('aria-pressed'),'false');w.close();
});
test('histogram includes maximum in last bin and zoom redraw preserves linked selection and resets scale',()=>{
 const {w,host}=setup();w.AnalyticsCharts.render(host,math.gaussian(measurement.rows.map(r=>r.value)),measurement.variable,{dataset:measurement});
 const figure=host.querySelector('figure'),bars=figure.querySelectorAll('rect[role=button]');bars[bars.length-1].dispatchEvent(new w.Event('click'));const selected=host.querySelector('.analytics-linked-records').textContent;assert.match(selected,/S4/);
 const path=figure.querySelector('[data-scientific-curve]'),original=path.getAttribute('d'),zoom=figure.querySelector('select');zoom.value='2';zoom.dispatchEvent(new w.Event('change'));assert.notEqual(figure.querySelector('[data-scientific-curve]').getAttribute('d'),original);assert.equal(host.querySelector('.analytics-linked-records').textContent,selected);assert.ok([...figure.querySelectorAll('[role=button]')].some(n=>Number(n.style.opacity)===.22));
 figure.querySelector('button').click();assert.equal(figure.querySelector('[data-scientific-curve]').getAttribute('d'),original);w.close();
});
test('KM uses steps and actual risk counts; Weibull offers five finite fitted and diagnostic plots',()=>{
 const {w,host}=setup(),data={kind:'life',variable:{name:'Vida',unit:'h'},rows:lives};
 w.AnalyticsCharts.render(host,math.kaplanMeier(lives,{unit:'h',independent_subjects:true,noninformative_censoring:true}),data.variable,{dataset:data});assert.match(host.querySelector('[data-scientific-curve]').getAttribute('d'),/H.*V/);assert.match(host.textContent,/População em risco/);assert.match(host.textContent,/18/);
 host.replaceChildren();w.AnalyticsCharts.render(host,math.weibull2p(lives,{unit:'h',independent_subjects:true,noninformative_censoring:true,single_population:true}),data.variable,{dataset:data});assert.equal(host.querySelectorAll('figure').length,5);assert.match(host.textContent,/Probabilidade Weibull/);for(const el of host.querySelectorAll('path,circle'))for(const attribute of ['d','cx','cy'])assert.doesNotMatch(el.getAttribute(attribute)||'',/NaN|Infinity/);w.close();
});
test('live monitor is single flight, honors rate limit, ignores paused and stopped late responses',async()=>{
 const {w}=setup();let finish,reads=0,received=0;const timers=new Map();let next=0;w.setTimeout=(fn,ms)=>{timers.set(++next,{fn,ms});return next;};w.clearTimeout=id=>timers.delete(id);
 const watch=w.AnalyticsLive.monitor(()=>{reads++;return new Promise(resolve=>{finish=resolve;});},()=>received++,()=>{});watch.refresh();watch.refresh();assert.equal(reads,1);watch.setEnabled(false);finish({success:true,data:{}});await flush();assert.equal(received,0);assert.equal(timers.size,0);
 watch.setEnabled(true);finish({success:false,retryAfter:60});await flush();assert.equal([...timers.values()][0].ms,60000);const retry=[...timers.values()][0];retry.fn();assert.equal(reads,3);watch.stop();finish({success:true,data:{}});await flush();assert.equal(received,0);assert.equal(timers.size,0);w.close();
});
test('unchanged live source preserves selected DOM, changed source recalculates without publishing',async()=>{
 const {w,host}=setup();let data=structuredClone(measurement),hash='one';data.source='application-condition';data.provenance={asset_code:'B-01',metric_code:'temperature',unit:'mm',from:'2026-09-01',through:'2026-09-30',records:data.rows.map((_,i)=>({recorded_at:'2026-09-0'+(i+1)+' 12:00:00'}))};const calls=[];
 w.API={get:async route=>{calls.push(route);return{success:true,data:{sha256:hash,dataset:data}};}};const frozen=JSON.stringify(data),watch=w.AnalyticsLive.condition(host,'study',{dataset:data});await flush();const svg=host.querySelector('svg');host.querySelector('rect[role=button]').dispatchEvent(new w.Event('click'));await watch.refresh();assert.equal(host.querySelector('svg'),svg);
 data=structuredClone(data);data.rows[0].value=10;hash='two';await watch.refresh();assert.notEqual(host.querySelector('svg'),svg);assert.match(host.textContent,/6/);assert.equal(JSON.parse(frozen).rows[0].value,0);assert.ok(calls.every(route=>route.includes('/sources/condition/live?')));watch.stop();w.close();
});
test('report reviews update safely together with the manifest and fixed job identity',async()=>{
 const {w,host}=setup();const initial={reviews:[],manifest:{payload_sha256:'old'}},next={reviews:[{decision:'accepted',reviewer:'Reviewer',reviewed_at:'2026-10-03T12:00:00Z',note:'<script>attack()</script>'}],manifest:{payload_sha256:'new'}};let payload=next,manifest;const calls=[];w.API={get:async route=>{calls.push(route);return{success:true,data:payload};}};
 const watch=w.AnalyticsLive.report(host,'job',initial,data=>{manifest=data.manifest.payload_sha256;});await flush();assert.equal(manifest,'new');assert.match(host.textContent,/<script>attack/);assert.equal(host.querySelectorAll('script').length,0);payload={...next,reviews:[]};await watch.refresh();assert.match(host.textContent,/Sem revisão/);assert.deepEqual(calls,['/analytics/jobs/job/report','/analytics/jobs/job/report']);watch.stop();w.close();
});
test('draft preview recalculates edits locally, preserves zero and absence, requires explicit survival assumptions',async()=>{
 const {w,d}=setup('<main></main><dialog open><form><div class="analytics-form"></div><input id="edit"></form></dialog>');let raw={kind:'measurements',variable:'Valor',unit:'mm',rows:[['A','0'],['B','2'],['C','']]};let writes=0;w.API={post:()=>writes++};const form=d.querySelector('form'),preview=w.AnalyticsLive.installDraft(form,()=>raw);preview.refresh();assert.match(form.textContent,/3 observações/);assert.match(form.textContent,/Ausentes1/);
 raw.rows[1][1]='6';d.querySelector('#edit').dispatchEvent(new w.Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,340));assert.match(form.textContent,/Média3/);assert.equal(writes,0);
 raw={kind:'life',variable:'Vida',unit:'h',rows:[['A','10','true'],['B','20','false']]};preview.refresh();assert.match(form.textContent,/Declare as hipóteses/);for(const checkbox of form.querySelectorAll('[data-live-draft] input[type=checkbox]'))checkbox.checked=true;preview.refresh();assert.match(form.textContent,/Kaplan–Meier/);w.close();
});

test('version curves compare distributions, reject mixed units, link version rows and gate survival hypotheses',()=>{
 const {w,host}=setup(),a={version:1,dataset:measurement},b={version:2,dataset:{...measurement,rows:measurement.rows.map(row=>({...row,value:row.value===null?null:row.value+2}))}};w.AnalyticsCurves.compare(host,a,b);assert.equal(host.querySelectorAll('figure').length,2);const point=host.querySelector('circle[role=button]');point.dispatchEvent(new w.Event('click'));assert.match(host.querySelector('.analytics-linked-records').textContent,/Versão 1/);host.replaceChildren();w.AnalyticsCurves.compare(host,a,{...b,dataset:{...b.dataset,variable:{...b.dataset.variable,unit:'cm'}}});assert.equal(host.querySelectorAll('svg').length,0);assert.match(host.textContent,/Não há conversão/);
 host.replaceChildren();const life={version:1,dataset:{kind:'life',variable:{name:'Vida',unit:'h'},rows:lives}};w.AnalyticsCurves.compare(host,life,{...life,version:2});host.querySelector('button').click();assert.equal(host.querySelectorAll('svg').length,0);for(const check of host.querySelectorAll('input'))check.checked=true;host.querySelector('button').click();assert.equal(host.querySelectorAll('svg').length,1);host.querySelector('input').checked=false;host.querySelector('input').dispatchEvent(new w.Event('change'));assert.equal(host.querySelectorAll('svg').length,0);w.close();
});
