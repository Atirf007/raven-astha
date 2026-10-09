'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('../../js/node_modules/jsdom');
const root=path.resolve(__dirname,'../../app'),flush=()=>new Promise(resolve=>setImmediate(resolve));
const source=name=>fs.readFileSync(path.join(root,'js',name),'utf8');
function page(name='analytics.html',query='') {
 const dom=new JSDOM(fs.readFileSync(path.join(root,name),'utf8'),{url:'https://astha.test/app/'+name+query,runScripts:'outside-only'}),w=dom.window;
 w.matchMedia=()=>({matches:false});w.Auth={getUser:()=>({role:'manager'}),requireAuth:()=>true};
 w.ProfileAvatar={render:()=>{}};w.OrganizationBrand={renderApplicationBrand:()=>{}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 return dom;
}
test('main web pages expose the same native studio route for eligible roles and preserve ordinary navigation',async()=>{
 for(const filename of ['sistema.html','home.html','settings.html','analytics.html']) {
  const dom=page(filename),w=dom.window,d=w.document;w.eval(source('app-shell.js'));await flush();
  const link=d.querySelector('.app-sidebar a[href="./analytics.html"]');assert.ok(link,filename);
  assert.equal(link.hidden,false);assert.equal(link.dataset.module,undefined);assert.equal(link.dispatchEvent(new w.MouseEvent('click',{cancelable:true})),true);
  for(const role of ['operator','viewer','unknown']){w.AppSidebar.renderNavigation({role});assert.equal(link.hidden,true,role);}
  w.AppSidebar.renderApplicationBrand({role:'admin'});assert.equal(link.hidden,false);
  w.AppSidebar.renderApplicationBrand({org_name:'Updated brand'});assert.equal(link.hidden,false,'brand-only refresh must not revoke visible navigation');
  w.AppSidebar.renderNavigation(null);assert.equal(link.hidden,true);w.close();
 }
});
test('equipment entry carries a code and period, never a record ID or arbitrary destination',async()=>{
 const dom=page('sistema.html'),w=dom.window,d=w.document;w.eval(source('analytics-entry.js'));await flush();const host=d.createElement('div');
 const code='P-01 & <img onerror=attack()>',link=w.AnalyticsEntry.equipmentLink(host,{id:921,asset_code:code},{from:'2026-09-01',through:'2026-09-30'}),url=new URL(link.href);
 assert.equal(url.origin,'https://astha.test');assert.equal(url.pathname,'/app/analytics.html');assert.equal(url.searchParams.get('asset_code'),code);assert.equal(url.searchParams.has('id'),false);assert.equal(host.querySelectorAll('img').length,0);
 w.Auth.getUser=()=>({role:'viewer'});assert.equal(w.AnalyticsEntry.equipmentLink(host,{asset_code:'P-01'}),undefined);w.close();
});
test('reliability shortcut uses the currently selected authorized equipment and dates',async()=>{
 const dom=page('sistema.html'),w=dom.window,d=w.document,actions=d.createElement('div');actions.className='eam-ux-actions';d.getElementById('panel-eam').append(actions);
 const select=d.getElementById('eamReliabilityAsset');select.append(new w.Option('Bomba','42'));select.value='42';d.getElementById('eamReliabilityFrom').value='2026-09-01';d.getElementById('eamReliabilityTo').value='2026-09-30';w.eamAssetsForWorkspace=[{id:42,asset_code:'BOMBA-02',name:'Bomba'}];
 w.eval(source('analytics-entry.js'));await flush();const link=actions.querySelector('a');assert.ok(link);link.addEventListener('click',event=>event.preventDefault());link.click();const url=new URL(link.href);assert.equal(url.searchParams.get('asset_code'),'BOMBA-02');assert.equal(url.searchParams.get('from'),'2026-09-01');assert.equal(url.searchParams.get('through'),'2026-09-30');w.close();
});
test('studio integrated-study entry waits for creation, preserves failed form, and passes validated context to the authorized source selector',async()=>{
 const dom=page('analytics.html','?asset_code=P-01%3Cimg%3E&from=2026-02-30&through=2026-09-30'),w=dom.window,d=w.document;let fail=true,opened=[];
 w.AppSidebar={renderApplicationBrand:()=>{}};w.AnalyticsSources={open:(...args)=>opened.push(args)};
 w.API={get:async url=>({success:true,data:url.endsWith('/catalog')?{execution_enabled:false}:url.endsWith('/studies')?{studies:[]}:{id:'study',name:'Estudo',question:'Pergunta',versions:[],jobs:[]}}),post:async()=>fail?{success:false,error:'Servidor indisponível'}:{success:true,data:{id:'study'}}};
 w.eval(source('industrial-analytics.js'));await flush();await flush();
 assert.equal(d.querySelectorAll('#analyticsContext img').length,0);[...d.querySelectorAll('#analyticsContext button')].find(b=>b.textContent==='Usar dados do ASTHA').click();
 const form=d.getElementById('studyForm');form.elements.name.value='Medição';form.elements.question.value='O que mudou?';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(opened.length,0);assert.equal(form.elements.name.value,'Medição');
 fail=false;form.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();await flush();assert.equal(opened.length,1);assert.equal(opened[0][0],'study');assert.equal(opened[0][2].asset_code,'P-01<img>');assert.equal(opened[0][2].from,undefined);assert.equal(opened[0][2].through,'2026-09-30');w.close();
});
test('source preselection waits for an authorized paginated equipment match and does not inject an unknown option',async()=>{
 const dom=page(),w=dom.window,d=w.document,calls=[];
 w.API={get:async url=>{calls.push(url);return{success:true,data:url.includes('/metrics?')?{metrics:[{metric_code:'temperature',unit:'C'}]}:url.includes('?after=')?{assets:[{asset_code:'P-02',name:'Two'}],has_more:false}:{assets:[{asset_code:'P-01',name:'One'}],has_more:true,next_cursor:'P-01'}};}};
 w.eval(source('analytics-sources.js'));await flush();w.AnalyticsSources.open('study',()=>{},{asset_code:'P-02',from:'2026-09-01',through:'2026-09-30'});await flush();
 const form=d.getElementById('sourceForm');assert.equal(form.elements.asset_code.value,'');assert.equal(form.elements.from.value,'2026-09-01');assert.equal(calls.some(url=>url.includes('/metrics?')),false);
 d.getElementById('moreSourceAssets').click();await flush();await flush();assert.equal(form.elements.asset_code.value,'P-02');assert.equal(form.elements.metric.options.length,2);
 d.getElementById('sourceDialog').close();w.AnalyticsSources.open('study',()=>{},{asset_code:'SECRET-OTHER-ORG'});await flush();assert.equal([...form.elements.asset_code.options].some(o=>o.value==='SECRET-OTHER-ORG'),false);w.close();
});
test('manual draft is session-only, survives close by study, and publication requires review of explicit null, zero and censoring',async()=>{
 const dom=page(),w=dom.window,d=w.document,posts=[];let fail=true,published=null;
 w.API={post:async(url,body)=>{posts.push({url,body});return fail?{success:false,error:'Falha temporária'}:{success:true,data:{id:'snapshot'}};}};
 w.eval(source('analytics-manual.js'));await flush();w.AnalyticsManual.open('study',async id=>{published=id;});const form=d.getElementById('dataForm');
 form.elements.variable.value='Temperatura';form.elements.unit.value='C';d.querySelector('#dataRows input').value='<img src=x onerror=attack()>';d.querySelectorAll('#dataRows input')[1].value='0';d.getElementById('addObservation').click();
 d.getElementById('dataDialog').close();w.AnalyticsManual.open('other',()=>{});form.elements.variable.value='Outro';d.getElementById('dataDialog').close();w.AnalyticsManual.open('study',async id=>{published=id;});
 assert.equal(form.elements.variable.value,'Temperatura');assert.equal(d.querySelectorAll('#dataRows tr').length,2);assert.equal(w.localStorage.length,0);
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(posts.length,0);assert.equal(d.getElementById('manualReviewDialog').open,true);assert.equal(d.querySelectorAll('#manualReviewContent img').length,0);assert.match(d.getElementById('manualReviewContent').textContent,/Ausente/);
 const review=d.getElementById('manualReviewForm');review.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(posts.length,0);
 review.elements.confirm.checked=true;review.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(posts[0].body.rows[0].value,0);assert.equal(posts[0].body.rows[1].value,null);assert.equal(d.getElementById('manualReviewDialog').open,true);assert.match(review.querySelector('[data-feedback]').textContent,/temporária/);
 fail=false;review.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();assert.equal(published,'study');assert.equal(d.getElementById('dataDialog').open,false);
 w.AnalyticsManual.open('study',()=>{});assert.equal(form.elements.variable.value,'');form.elements.kind.value='life';form.elements.kind.dispatchEvent(new w.Event('change'));form.elements.variable.value='Vida';form.elements.unit.value='h';d.querySelectorAll('#dataRows input')[1].value='10';
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(d.getElementById('manualReviewDialog').open,false,'unknown event must not become censoring');
 d.querySelector('#dataRows select').value='false';form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.match(d.getElementById('manualReviewContent').textContent,/Censura à direita/);w.close();
});
test('unavailable studio API blocks entry until explicit retry succeeds and never substitutes local test data',async()=>{
 const dom=page(),w=dom.window,d=w.document;let available=false,calls=0;
 w.AppSidebar={renderApplicationBrand:()=>{}};w.API={get:async url=>{calls++;return available?{success:true,data:url.endsWith('/catalog')?{execution_enabled:false}:{studies:[]}}:{success:false,error:'HTTP 404'};}};
 w.eval(source('industrial-analytics.js'));await flush();await flush();assert.equal(calls,1);assert.match(d.getElementById('analyticsFeedback').textContent,/servidor ativo/);
 for(const button of d.querySelectorAll('#analyticsContext button,#newStudy'))assert.equal(button.disabled,true);
 available=true;d.querySelector('#analyticsFeedback button').click();await flush();await flush();assert.equal(calls,3);assert.equal(d.getElementById('newStudy').disabled,false);assert.equal(d.querySelector('#analyticsFeedback button'),null);assert.match(d.getElementById('studyList').textContent,/Nenhum estudo/);w.close();
});
test('closing study creation discards a late response instead of opening a source window unexpectedly',async()=>{
 const dom=page(),w=dom.window,d=w.document;let resolvePost,opened=0;
 w.AppSidebar={renderApplicationBrand:()=>{}};w.AnalyticsSources={open:()=>{opened++;}};
 w.API={get:async url=>({success:true,data:url.endsWith('/catalog')?{execution_enabled:false}:{studies:[]}}),post:()=>new Promise(resolve=>{resolvePost=resolve;})};
 w.eval(source('industrial-analytics.js'));await flush();await flush();[...d.querySelectorAll('#analyticsContext button')].find(b=>b.textContent==='Usar dados do ASTHA').click();const form=d.getElementById('studyForm');form.elements.name.value='Estudo';form.elements.question.value='Pergunta';form.dispatchEvent(new w.Event('submit',{cancelable:true}));
 d.getElementById('studyDialog').close();resolvePost({success:true,data:{id:'study'}});await flush();await flush();assert.equal(opened,0);assert.equal(d.querySelector('#studyWorkspace h2').textContent,'Selecione um estudo');w.close();
});
test('manual review paginates every original observation, rejects duplicate subjects, and clears drafts on navigation',async()=>{
 const dom=page(),w=dom.window,d=w.document;w.eval(source('analytics-manual.js'));await flush();w.AnalyticsManual.open('study',()=>{});const form=d.getElementById('dataForm');form.elements.variable.value='Leitura';form.elements.unit.value='C';
 for(let i=1;i<220;i++)d.getElementById('addObservation').click();form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(d.querySelectorAll('#manualReviewContent tbody tr').length,100);
 [...d.querySelectorAll('#manualReviewContent button')].find(b=>b.textContent==='Próximas observações').click();assert.match(d.getElementById('manualReviewContent').textContent,/Página 2 de 3/);[...d.querySelectorAll('#manualReviewContent button')].find(b=>b.textContent==='Próximas observações').click();assert.equal(d.querySelectorAll('#manualReviewContent tbody tr').length,20);
 d.getElementById('manualReviewDialog').close();d.querySelectorAll('#dataRows tr input')[2].value='S-1';form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(d.getElementById('manualReviewDialog').open,false);assert.match(form.querySelector('[data-feedback]').textContent,/únicos/);
 w.dispatchEvent(new w.Event('pagehide'));assert.equal(d.getElementById('dataRows').children.length,0);assert.equal(d.getElementById('manualReviewContent').children.length,0);w.close();
});
