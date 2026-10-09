'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('../../js/node_modules/jsdom');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('study dialogs retain failed drafts, render untrusted text safely and require explicit KM assumptions',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../../app/analytics.html'),'utf8'),{url:'https://astha.test/app/analytics.html',runScripts:'outside-only'});
 const {window:w}=dom,d=w.document;let saved=false,posted=[];
 const name='<img src=x onerror=alert(1)>',life={kind:'life',variable:{name:'Vida',unit:'h'},rows:[{subject_id:'A',duration:10,event:false}]};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.Auth={requireAuth:()=>true,getUser:()=>({role:'manager'})};w.AppSidebar={renderApplicationBrand:()=>{}};w.ProfileAvatar={render:()=>{}};
 w.API={get:async url=>({success:true,data:url.endsWith('/catalog')?{execution_enabled:true}:url.endsWith('/studies')?{studies:[{id:'study',name}],has_more:false}:url.includes('/snapshots/')?{id:'snapshot',version:1,row_count:1,dataset:life}:{id:'study',name,question:'<script>attack()</script>',versions:[{id:'snapshot',version:1,row_count:1}],jobs:[]}}),post:async(url,body)=>{posted.push({url,body});return saved?{success:true,data:{id:'study'}}:{success:false,error:'Falha transitória'};}};
 w.eval(fs.readFileSync(path.join(__dirname,'../../app/js/industrial-analytics.js'),'utf8'));await flush();await flush();
 d.querySelector('#studyList button').click();await flush();await flush();
 assert.match(d.querySelector('#studyWorkspace').textContent,/<img/);assert.equal(d.querySelectorAll('#studyWorkspace img,#studyWorkspace script').length,0);
 d.getElementById('newStudy').click();const form=d.getElementById('studyForm');form.elements.name.value='Meu estudo';form.elements.question.value='Minha pergunta';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
 assert.equal(d.getElementById('studyDialog').open,true);assert.equal(form.elements.name.value,'Meu estudo');assert.equal(form.querySelector('[data-feedback]').textContent,'Falha transitória');assert.equal(form.querySelector('[type=submit]').disabled,false);
 d.getElementById('studyDialog').close();[...d.querySelectorAll('#studyWorkspace button')].find(b=>b.textContent==='Executar análise').click();
 const run=d.getElementById('runForm'),before=posted.length;run.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(posted.length,before);assert.match(run.querySelector('[data-feedback]').textContent,/hipóteses/);
 run.elements.independent.checked=true;run.elements.censoring.checked=true;run.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(posted.at(-1).body.method,'kaplan-meier-right/1');assert.equal(posted.at(-1).body.parameters.noninformative_censoring,true);assert.equal(d.getElementById('runDialog').open,true);
 run.elements.method.value='weibull-2p-right/1';run.elements.method.dispatchEvent(new w.Event('change'));assert.match(d.getElementById('runContext').textContent,/Weibull/);assert.equal(d.getElementById('populationAssumption').hidden,false);
 const kmPosts=posted.length;run.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(posted.length,kmPosts);assert.match(run.querySelector('[data-feedback]').textContent,/população/);run.elements.population.checked=true;run.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(posted.at(-1).body.parameters.single_population,true);
 dom.window.close();
});

test('history pagination preserves selection, prevents duplicates and exposes an older snapshot',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../../app/analytics.html'),'utf8'),{url:'https://astha.test/app/analytics.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.Auth={requireAuth:()=>true,getUser:()=>({role:'manager'})};w.AppSidebar={renderApplicationBrand:()=>{}};w.ProfileAvatar={render:()=>{}};
 const calls=[];w.API={get:async url=>{calls.push(url);let data;
  if(url.endsWith('/catalog'))data={execution_enabled:true};
  else if(url==='/analytics/studies')data={studies:[{id:'s',name:'Estudo'}],has_more:true,next_cursor:'s'};
  else if(url.includes('/studies?after='))data={studies:[{id:'s',name:'Estudo'},{id:'older',name:'Anterior'}],has_more:false};
  else if(url.includes('/versions?'))data={versions:[{id:'v5',version:5,row_count:1}],has_more:false};
  else if(url.includes('/jobs?'))data={jobs:[{id:'j1',method:'descriptive/1',status:'completed'},{id:'j0',method:'descriptive/1',status:'failed'}],has_more:false};
  else if(url.includes('/snapshots/')){const old=url.endsWith('/v5');data={id:old?'v5':'v105',version:old?5:105,row_count:1,dataset:{kind:'measurements',variable:{name:old?'Histórica':'Atual',unit:'C'},rows:[{subject_id:'A',value:old?5:105}]}};}
  else data={id:'s',name:'Estudo',question:'Pergunta',versions:[{id:'v105',version:105,row_count:1}],jobs:[{id:'j1',method:'descriptive/1',status:'completed'}],more_versions:true,version_cursor:105,more_jobs:true,job_cursor:'j1'};
  return{success:true,data};
 }};
 w.eval(fs.readFileSync(path.join(__dirname,'../../app/js/industrial-analytics.js'),'utf8'));await flush();await flush();
 [...d.querySelectorAll('#studyList button')].find(b=>b.textContent==='Carregar mais estudos').click();await flush();assert.equal(d.querySelectorAll('#studyList [data-study-id]').length,2);assert.equal(d.querySelectorAll('[data-study-more]').length,0);
 d.querySelector('#studyList [data-study-id="s"]').click();await flush();await flush();const select=d.querySelector('#studyWorkspace select');assert.equal(select.value,'v105');
 [...d.querySelectorAll('#studyWorkspace button')].find(b=>b.textContent==='Carregar versões anteriores').click();await flush();assert.equal(select.value,'v105');assert.equal(select.options.length,2);
 [...d.querySelectorAll('#studyWorkspace button')].find(b=>b.textContent==='Carregar execuções anteriores').click();await flush();assert.equal(d.querySelectorAll('#studyWorkspace [data-job-id]').length,2);
 select.value='v5';select.dispatchEvent(new w.Event('change'));await flush();assert.match(d.getElementById('snapshotPreview').textContent,/Histórica/);assert.ok(calls.some(url=>url.includes('snapshots/v5')));w.close();
});

test('web evidence report renders safely, exports a private CSV, prints and retains a failed review draft',async()=>{
 const {dataset}=require('../../api/services/analytics/datasets'),{run}=require('../../api/services/analytics/runner'),{evidence}=require('../../api/services/analytics/evidence');
 const snap=dataset({kind:'measurements',variable:{name:'Temperatura',unit:'C'},rows:[{subject_id:'A',value:10},{subject_id:'B',value:20}]});
 const output=await run(snap.data,'descriptive/1',{}),job={id:'job',method:'descriptive/1',status:'completed',can_review:true,result:{...output,snapshot_id:'snapshot',snapshot_hash:snap.hash,parameters:{},variable:snap.data.variable}};
 const pack=evidence({name:'<img src=x onerror=bad()>',question:'Pergunta'},{id:'snapshot',version:1,dataset:snap.data,content_hash:snap.hash},job);
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../../app/analytics.html'),'utf8'),{url:'https://astha.test/app/analytics.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.Auth={requireAuth:()=>true,getUser:()=>({role:'admin'})};w.AppSidebar={renderApplicationBrand:()=>{}};w.ProfileAvatar={render:()=>{}};
 w.API={get:async url=>({success:true,data:url.endsWith('/catalog')?{execution_enabled:true}:url.endsWith('/report')||url.endsWith('/package')?pack:url.endsWith('/jobs/job')?job:url.endsWith('/studies')?{studies:[{id:'study',name:'Estudo'}]}:url.includes('/snapshots/')?{id:'snapshot',version:1,row_count:2,dataset:snap.data}:{id:'study',name:'Estudo',question:'Pergunta',versions:[{id:'snapshot',version:1,row_count:2}],jobs:[job]}}),post:async(url,body)=>url.endsWith('/artifacts')?{success:true,data:require('../../api/services/analytics/artifacts').artifact(pack,body.profile)}:{success:false,error:'Revisão recusada'},request:async(_url,options)=>{assert.equal(options.responseType,'text');return{success:true,data:{content:'subject_id,value\r\nA,10'}};}};
 let printed=false,downloaded,blob;w.print=()=>{assert.equal(d.body.classList.contains('analytics-printing'),true);printed=true;};w.Blob=Blob;w.URL.createObjectURL=value=>{blob=value;return'blob:https://astha.test/test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){downloaded=this.download;};
 w.eval(fs.readFileSync(path.join(__dirname,'../../app/js/analytics-artifacts.js'),'utf8'));w.eval(fs.readFileSync(path.join(__dirname,'../../app/js/industrial-analytics.js'),'utf8'));await flush();await flush();d.querySelector('#studyList button').click();await flush();await flush();
 [...d.querySelectorAll('#studyWorkspace button')].find(b=>b.textContent==='Examinar').click();await flush();[...d.querySelectorAll('#analyticsOutput button')].find(b=>b.textContent==='Relatório e exportações').click();await flush();await flush();
 assert.equal(d.getElementById('reportDialog').open,true);assert.equal(d.querySelectorAll('#reportContent img,#reportContent script').length,0);assert.match(d.getElementById('reportContent').textContent,/SHA-256/);
 [...d.querySelectorAll('#reportActions button')].find(b=>b.textContent==='Imprimir / salvar PDF').click();assert.equal(printed,true);assert.equal(d.body.classList.contains('analytics-printing'),false);
 [...d.querySelectorAll('#reportActions button')].find(b=>b.textContent==='Configurar exportação').click();const exports=d.getElementById('artifactForm');exports.elements.format.value='csv';exports.elements.identifiers.checked=true;exports.dispatchEvent(new w.Event('change'));exports.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();d.getElementById('downloadArtifact').click();await flush();assert.equal(downloaded,'astha-observacoes.csv');assert.match(await blob.text(),/A/);d.getElementById('artifactDialog').close();
 [...d.querySelectorAll('#reportActions button')].find(b=>b.textContent==='Registrar revisão').click();const form=d.getElementById('reviewForm');form.elements.decision.value='accepted';form.elements.note.value='Minha justificativa';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(d.getElementById('reviewDialog').open,true);assert.equal(form.elements.note.value,'Minha justificativa');assert.equal(form.querySelector('[data-feedback]').textContent,'Revisão recusada');
 w.close();
});

test('result chart keeps frozen version distinct from selected data and life observations remain text',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../../app/analytics.html'),'utf8'),{url:'https://astha.test/app/analytics.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.Auth={requireAuth:()=>true,getUser:()=>({role:'admin'})};w.AppSidebar={renderApplicationBrand:()=>{}};w.ProfileAvatar={render:()=>{}};
 const life={kind:'life',variable:{name:'Vida',unit:'h'},rows:[{subject_id:'<img onerror=attack()>',duration:10,event:true},{subject_id:'B',duration:20,event:false}]};
 const job={id:'j',snapshot_id:'v1',method:'kaplan-meier-right/1',status:'completed',result:{method:'kaplan-meier-right/1',variable:life.variable,result:{subjects:2,events:1,censored:1,median:10,limitations:[],curve:[{time:10,survival:.5,at_risk:2,events:1,censored:0},{time:20,survival:.5,at_risk:1,events:0,censored:1}]},limitations:[]}};
 w.API={get:async url=>({success:true,data:url.endsWith('/catalog')?{execution_enabled:true}:url.endsWith('/studies')?{studies:[{id:'s',name:'Estudo'}]}:url.endsWith('/jobs/j')?job:url.includes('/snapshots/')?{id:'v2',version:2,row_count:2,dataset:life}:{id:'s',name:'Estudo',question:'Pergunta',versions:[{id:'v2',version:2,row_count:2},{id:'v1',version:1,row_count:2}],jobs:[job]}})};
 w.eval(fs.readFileSync(path.join(__dirname,'../../app/js/industrial-analytics.js'),'utf8'));await flush();await flush();d.querySelector('#studyList button').click();await flush();await flush();
 assert.equal(d.querySelectorAll('.analytics-life-row').length,2);assert.equal(d.querySelector('.analytics-life-bar').dataset.event,'true');assert.equal(d.querySelectorAll('.analytics-life-timeline img').length,0);
 d.querySelector('.analytics-job button').click();await flush();await flush();
 assert.match(d.querySelector('#studyQuality').textContent,/Versão 2/);assert.match(d.querySelector('#displayedJobContext').textContent,/Versão 1/);
 const curve=d.querySelector('path[data-curve="step"]');assert.ok(curve);assert.match(curve.getAttribute('d'),/ H.* V/);assert.doesNotMatch(curve.getAttribute('d'),/ L/);assert.equal(d.querySelector('#workspaceResults').hidden,false);
 assert.equal(d.querySelector('#analyticsTheme'),null);assert.equal(w.localStorage.length,0);w.close();
});
