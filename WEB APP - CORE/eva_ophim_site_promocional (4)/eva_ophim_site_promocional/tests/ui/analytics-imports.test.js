'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('../../js/node_modules/jsdom');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function until(check){for(let i=0;i<40;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('UI did not reach expected state');}
test('file import dialog preserves failed drafts, escapes cells, invalidates changed previews and publishes confirmed hash',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../../app/analytics.html'),'utf8'),{url:'https://astha.test/app/analytics.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 let failUpload=true,failPublish=true,published=null;const posts=[],requests=[];
 const ready={id:'import',format:'csv',origin:'Origem',row_count:2,columns:['id','valor'],preview:[['<img src=x onerror=bad()>','0'],['0002','']]};
 w.API={get:async()=>({success:true,data:{imports:[{id:'import',origin:'Coleta anterior',format:'csv'}]}}),request:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return failUpload?{success:false,error:'Parser indisponível'}:{success:true,data:ready};},post:async(url,body)=>{posts.push({url,body});if(url.endsWith('/mapping'))return{success:true,data:{sha256:'a'.repeat(64),kind:'measurements',variable:body.variable,row_count:2,preview:[{subject_id:'<img src=x onerror=bad()>',value:0},{subject_id:'0002',value:null}]}};return failPublish?{success:false,error:'Conflito de prévia'}:{success:true,data:{id:'version'}};}};
 w.eval(fs.readFileSync(path.join(__dirname,'../../app/js/analytics-imports.js'),'utf8'));await flush();w.AnalyticsImports.open('study',async id=>{published=id;},true);await flush();
 assert.equal(d.getElementById('importResumeField').hidden,false);const upload=d.getElementById('importUpload'),mapping=d.getElementById('importMapping');upload.elements.origin.value='Coleta da bancada';
 Object.defineProperty(upload.elements.file,'files',{configurable:true,value:[new w.File(['id;valor\nA;0'],'coleta.csv',{type:'text/csv'})]});
 // jsdom cannot populate a native FileList/value; the production handler also checks files and size.
 upload.reportValidity=()=>true;
 upload.dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>d.querySelector('#importDialog [data-feedback]').textContent==='Parser indisponível');assert.equal(upload.elements.origin.value,'Coleta da bancada');assert.equal(upload.querySelector('[type=submit]').disabled,false);
 failUpload=false;upload.dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>!mapping.hidden);assert.equal(d.querySelectorAll('#importRawPreview img,#importRawPreview script').length,0);assert.match(d.getElementById('importRawPreview').textContent,/<img/);
 mapping.elements.variable.value='Temperatura';mapping.elements.unit.value='C';mapping.elements.subject_column.value='id';mapping.elements.value_column.value='valor';mapping.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(d.getElementById('publishImport').disabled,true);assert.equal(d.querySelectorAll('#importMappedPreview img').length,0);assert.match(d.getElementById('importMappedPreview').textContent,/Ausente/);
 const confirm=d.getElementById('confirmImport');confirm.checked=true;confirm.dispatchEvent(new w.Event('change'));assert.equal(d.getElementById('publishImport').disabled,false);
 mapping.elements.unit.value='K';mapping.elements.unit.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(d.getElementById('publishImport').disabled,true);assert.equal(confirm.checked,false);
 mapping.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();confirm.checked=true;confirm.dispatchEvent(new w.Event('change'));d.getElementById('publishImport').click();await flush();assert.equal(d.getElementById('importDialog').open,true);assert.equal(mapping.elements.unit.value,'K');assert.match(d.querySelector('#importDialog [data-feedback]').textContent,/Conflito/);
 failPublish=false;d.getElementById('publishImport').click();await flush();assert.equal(published,'study');assert.deepEqual(JSON.parse(JSON.stringify(posts.at(-1).body)),{expected_hash:'a'.repeat(64)});assert.equal(d.getElementById('importDialog').open,false);
 assert.equal(Buffer.from(requests[1].body.content,'base64').toString(),'id;valor\nA;0');assert.equal(requests[1].body.origin,'Coleta da bancada');w.close();
});
test('file input gate remains disabled without isolated parser configuration',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../../app/analytics.html'),'utf8'),{url:'https://astha.test/',runScripts:'outside-only'}),w=dom.window,d=w.document;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.API={get:async()=>({success:true,data:{imports:[]}})};
 w.eval(fs.readFileSync(path.join(__dirname,'../../app/js/analytics-imports.js'),'utf8'));await flush();w.AnalyticsImports.open('study',()=>{},false);await flush();assert.equal(d.querySelector('#importUpload [type=submit]').disabled,true);assert.match(d.getElementById('importCapability').textContent,/isolado/);assert.equal(d.getElementById('publishImport').disabled,true);w.close();
});
