const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../../js/node_modules/jsdom');
const root = process.env.FRONTEND_SOURCE_ROOT || path.resolve(__dirname, '../..');
function setup() {
  const dom = new JSDOM('<div id="toastContainer"></div><table><tbody id="stockTableBody"></tbody><tbody id="criticalTableBody"></tbody><tbody id="reportsTableBody"></tbody></table><span id="reportTotal"></span><span id="reportEntries"></span><span id="reportExits"></span><button id="reportExport"></button><div id="reportsEmpty"></div><div id="usersGrid"></div><div id="warehouseTabs"></div><div id="infoModalTitle"></div><div id="infoContent"></div><div id="moreInfoModal"></div><div id="infoFilesList"></div><div id="componentsGrid"></div><div id="componentsEmpty"></div><button id="newComponentButton"></button><div id="componentModal"><form id="componentForm"><div id="compMaterialsList"></div></form></div>', {runScripts:'outside-only', url:'http://localhost/'});
  const w = dom.window;
  w.Auth = {canEdit:()=>true, canManageUsers:()=>true, requireAuth:()=>false, getUser:()=>null};
  w.API={get:async()=>({success:true,data:[]})};
  w.setupInfoMediaGallery=()=>{};
  w.eval(['security.js','sistema-core.js','sistema-features.js'].map(f=>fs.readFileSync(path.join(root,'app/js',f),'utf8')).join('\n') + '\nwindow.setMaterials = v => { materials = v; }; window.setUsers = v => { users = v; }; window.setMovements = v => { movements = v; }; window.setComponents = v => { customComponents = v; };');
  return dom;
}
const sentinel = '<img src=x onerror="window.CODEX_XSS_SENTINEL=1">';
test('SEC-FE-001 toast treats markup as literal text', () => {
  const dom=setup(); const w=dom.window;
  w.showToast(sentinel); assert.equal(w.document.querySelector('#toastContainer img'),null);
  assert.equal(w.document.querySelector('#toastContainer span').textContent,sentinel); dom.window.close();
});
test('SEC-FE-003 both material detail designs encode fields, URLs and callbacks', async () => {
  for (const oldDesign of [false,true]) {
    const dom=setup(); const w=dom.window;
    const m={code:"X');window.CODEX_XSS_SENTINEL=1;//",desc:sentinel,brand:sentinel,model:sentinel,sector:sentinel,location:sentinel,qty:3,min:1,max:5,price:2,machineryName:sentinel,machineryDesc:sentinel,notes:sentinel,usageDesc:sentinel,interchangeable:true,interchangeWith:sentinel,manufacturerUrl:'javascript:window.CODEX_XSS_SENTINEL=1'};
    w.setMaterials([m]); w.useOldDesign=oldDesign; await w.openMoreInfo(m.code);
    const body=w.document.getElementById('infoContent');
    assert.equal(body.querySelector('img[onerror]'),null);
    assert.equal(body.querySelector('a[href^="javascript:"]'),null);
    assert.equal(Array.from(body.querySelectorAll('[onclick]')).some(e=>e.getAttribute('onclick').includes(m.code)),false);
    assert.ok(body.textContent.includes(sentinel)); dom.window.close();
  }
});
test('SEC-FE-003 file labels and callbacks use DOM data', () => {
  const dom=setup(); const w=dom.window;
  w._renderInfoFilesList([{id:1,category:'manual',filename:sentinel,mime_type:'application/pdf'}],"X');alert(1);//");
  const el=w.document.getElementById('infoFilesList');
  assert.equal(el.querySelector('img'),null); assert.equal(el.querySelector('[onclick]'),null);
  let args; w._openInfoFile=(...a)=>{args=a;}; el.querySelector('button').click();
  assert.deepEqual(Array.from(args),[1,"X');alert(1);//",sentinel]); dom.window.close();
});
test('SEC-FE-003 reports and components keep stored data inert', () => {
  const dom=setup(); const w=dom.window;
  w.setMovements([{date:sentinel,code:sentinel,desc:sentinel,opClass:'entry',operation:sentinel,qty:1,responsible:sentinel}]); w.renderReports();
  w.setMaterials([{code:sentinel,desc:sentinel,price:2}]);
  w.setComponents([{name:sentinel,description:sentinel,materials:[{code:sentinel,qty:1}]}]); w.renderComponents(); w.addCompMaterialRow();
  assert.equal(w.document.querySelector('img'),null);
  assert.equal(w.document.querySelector('option').value,sentinel); dom.window.close();
});
test('SEC-FE-003 component creation control opens the actual form', () => {
  const dom=setup(); const w=dom.window;
  w.document.getElementById('newComponentButton').click();
  assert.equal(w.document.getElementById('componentModal').classList.contains('active'),true);
  assert.equal(w.document.querySelectorAll('#compMaterialsList select').length,1);
  dom.window.close();
});
test('SEC-FE-001 stock text, image attributes and action arguments stay data', () => {
  const dom=setup(); const w=dom.window;
  const material={code:"X');window.CODEX_XSS_SENTINEL=1;//",desc:sentinel,brand:sentinel,sector:sentinel,location:sentinel,qty:5,min:1,price:2,image:'x" onerror="window.CODEX_XSS_SENTINEL=1'};
  w.setMaterials([material]); w.renderStock();
  const body=w.document.getElementById('stockTableBody');
  assert.equal(body.querySelectorAll('img[onerror]').length,0);
  assert.equal(body.querySelectorAll('img').length,1);
  assert.ok(body.textContent.includes(sentinel));
  assert.equal(body.querySelectorAll('[onclick]').length,0);
  let args; w.showQRCode=(...a)=>{args=a;}; body.querySelector('[title="QR Code"]').click();
  assert.deepEqual(Array.from(args),[material.code,material.desc]); dom.window.close();
});
test('SEC-FE-002 user identity fields cannot add active markup', () => {
  const dom=setup(); const w=dom.window;
  w.setUsers([{id:7,name:sentinel,email:sentinel,role:'viewer'}]);
  w.renderUsers(); assert.equal(w.document.querySelector('#usersGrid img'),null);
  assert.ok(w.document.getElementById('usersGrid').textContent.includes(sentinel));
  let args; w.changeUserRole=(...a)=>{args=a;}; const select=w.document.querySelector('#usersGrid select');
  select.value='operator'; select.dispatchEvent(new w.Event('change'));
  assert.deepEqual(Array.from(args),[7,'operator']); dom.window.close();
});
test('SEC-FE-001 warehouse names and IDs cannot become executable markup', () => {
  const dom=setup(); const w=dom.window;
  w.renderWarehouseTabs([{id:7,name:sentinel}]);
  const tab=w.document.querySelector('#warehouseTabs button');
  assert.equal(tab.querySelector('img'),null); assert.equal(tab.textContent,sentinel);
  assert.equal(tab.hasAttribute('onclick'),false);
  let id; w.selectWarehouse=value=>{id=value;}; tab.click(); assert.equal(id,7); dom.window.close();
});
test('SEC-FE-008 digital twin renders stored asset fields as inert text', async () => {
  const dom=setup(); const w=dom.window, target=w.document.createElement('div'); target.id='eamDigitalTwin'; w.document.body.appendChild(target);
  w.API.get=async()=>({success:true,data:{asset:{asset_code:sentinel,name:sentinel,status:'active',criticality:'high'},model_code:sentinel,model_name:sentinel,modules:[{code:sentinel,name:sentinel}],positions:[{position_number:sentinel,name:sentinel}],instances:[{status:'installed'}],visuals:[],revisions:[]}});
  await w.loadEamDigitalTwin(1);
  assert.equal(target.querySelector('img'),null); assert.ok(target.textContent.includes(sentinel)); dom.window.close();
});
test('SEC-WEB-004 authentication artifacts are never placed in download URLs', () => {
  for (const file of ['sistema-features.js','sistema-3d-viewer.js']) {
    const source=fs.readFileSync(path.join(root,'app/js',file),'utf8');
    assert.doesNotMatch(source, /[?&]token=/);
  }
  const middleware=fs.readFileSync(path.join(root,'api/middleware/auth.js'),'utf8');
  assert.doesNotMatch(middleware, /req\.query\.token/);
});
test('SEC-WEB-005 OAuth and WebAuthn cannot mint browser-trusted sessions', () => {
  const source=fs.readFileSync(path.join(root,'app/js/auth.js'),'utf8');
  assert.doesNotMatch(source, /setToken\(['"](?:google_|ms_|webauthn_)/);
  assert.doesNotMatch(source, /response_type=token|oauth_'\s*\+/);
  assert.match(source, /auth\/oauth\/google/); assert.match(source, /auth\/oauth\/microsoft/);
});
test('SEC-WEB-006 onboarding encodes user-controlled position fields', () => {
  const source=fs.readFileSync(path.join(root,'app/onboarding.html'),'utf8');
  assert.match(source, /escapeHTML\(p\.name\)/); assert.match(source, /escapeHTML\(p\.department/);
});
test('SEC-WEB-007 MapHub encodes imported/local data before HTML and CSS sinks', () => {
  const source=fs.readFileSync(path.join(root,'app/sistema.html'),'utf8');
  for (const pattern of [/mhEsc\(m\.name\)/,/mhEsc\(s\.name\)/,/mhEsc\(i\.material\)/,/mhEsc\(item\.location/,/mhColor\(item\.color\)/,/mhNum\(item\.x\)/]) assert.match(source,pattern);
  for (const pattern of [/mhEsc\(sid\)/,/mhEsc\(loc\)/,/mhEsc\(item\.material\)/,/mhEsc\(shortCode\)/,/mhJsArg\(item\.id\)/,/mhJsArg\(activeLoc\)/]) assert.match(source,pattern);
  assert.match(source,/function mhImage/); assert.match(source,/function mhJsArg/);
  assert.doesNotMatch(source,/onclick="mhShowItemInfo\(\s*['"]\s*\+\s*item\.id/);
});
