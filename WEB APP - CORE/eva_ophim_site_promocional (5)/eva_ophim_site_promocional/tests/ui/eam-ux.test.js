const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('../../js/node_modules/jsdom');
const root=path.resolve(__dirname,'../..');const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('operational pages start light before scripts and cannot restore the retired dark theme',()=>{
 const html=fs.readFileSync(path.join(root,'app/sistema.html'),'utf8');
 const dom=new JSDOM(html);try{
  assert.equal(dom.window.document.documentElement.classList.contains('light-mode'),true);
  assert.equal(dom.window.document.querySelector('#themeToggle'),null);
  assert.equal(html.includes("getItem('astha_theme')"),false);
  assert.equal(html.includes('function toggleTheme'),false);
 }finally{dom.window.close();}
});
async function setup(){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'app/sistema.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/app/sistema.html'}),w=dom.window;
 w.Auth={requireAuth:()=>false,getUser:()=>null};w.showToast=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const calls=[];
 w.API={get:async endpoint=>{calls.push(endpoint);return {success:true,data:endpoint==='/eam/assets'?[{id:11,asset_code:'AT-11',name:'Motor',status:'active'}]:endpoint.includes('/reliability/assets/')?{period:{hours:720},failures:null,corrective_orders:2,downtime_hours:4,availability:null,calendar_availability:716/720,exposure:{unknown_hours:716},mtbf_hours:null,mttr_hours:null,mtws_hours:null,tco:100,warnings:['Sem exposição operacional observada.']}:endpoint.endsWith('/condition')?{rules:[],readings:[],alerts:[]}:[]};},post:async(endpoint,body)=>{calls.push({endpoint,body});return {success:true,data:{id:3}};}};
 w.eval(['security.js','sistema-core.js','eam-ux.js'].map(file=>fs.readFileSync(path.join(root,'app/js',file),'utf8')).join('\n'));
 await settle();return {dom,w,calls};
}
test('order creation opens a modal and loads tenant assets directly without procurement requests',async()=>{
 const {dom,w,calls}=await setup();try{
  await w.toggleEamOrderForm(true);
  assert.equal(w.document.querySelector('#eamOrderCreatePanel'),null);
  assert.equal(w.document.querySelector('#eamOrderCreateDialog').open,true);
  assert.equal(w.document.querySelector('#eamOrderAsset').options[1].value,'11');
  assert.deepEqual(calls,['/eam/assets']);
  w.document.querySelector('#eamOrderAsset').value='11';w.document.querySelector('#eamOrderTitle').value='Inspeção';
  w.renderEam=async()=>{};
  await w.createEamWorkOrder({preventDefault(){},target:w.document.querySelector('#eamOrderCreateForm')});
  assert.equal(calls[1].body.asset_id,11);assert.equal(w.document.querySelector('#eamOrderCreateDialog').open,false);
 }finally{dom.window.close();}
});
test('reliability prioritizes real indicators and graphs while editors open in dialogs',async()=>{
 const {dom,w}=await setup();try{
  w.switchEamSection('reliability',w.document.querySelector('[onclick*="reliability"]'));await settle();await settle();
  assert.equal(w.document.querySelector('#eamReliabilityAsset').value,'11');
  assert.ok(w.document.querySelector('#eamReliabilityResult').textContent.includes('Sem dados'));
  assert.ok(w.document.querySelector('#eamReliabilityResult').textContent.includes('Disponibilidade no calendário'));
  assert.ok(w.document.querySelector('#eamReliabilityCharts').textContent.includes('Sem exposição operacional observada.'));
  assert.equal(w.document.querySelectorAll('#eamReliabilityCharts svg').length,1);
  assert.equal(w.document.querySelectorAll('#eam-reliability form').length,1);
  const button=[...w.document.querySelectorAll('.eam-ux-actions button')].find(el=>el.textContent==='Cadastrar limite');button.click();
  assert.equal(w.document.querySelector('#eamConditionRulesDialog').open,true);
  assert.equal(w.document.querySelector('#eamConditionAsset').value,'11');
 }finally{dom.window.close();}
});
test('failed asset loading disables order submission and gives a visible explanation',async()=>{
 const {dom,w}=await setup();try{
  w.API.get=async()=>({success:false,error:'Ativos indisponíveis'});
  await w.toggleEamOrderForm(true);
  assert.equal(w.document.querySelector('#eamOrderCreateForm [type=submit]').disabled,true);
  assert.equal(w.document.querySelector('#eamOrderCreateDialog [role=status]').textContent,'Ativos indisponíveis');
 }finally{dom.window.close();}
});
