const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../../js/node_modules/jsdom');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'app/sistema.html'), 'utf8');

test('decimal stock is summed numerically and zero stock is classified correctly', () => {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const w = dom.window;
  try {
    w.Auth = { requireAuth: () => false };
    w.eval(fs.readFileSync(path.join(root, 'app/js/security.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'app/js/sistema-core.js'), 'utf8') + `
drawDonut=()=>{};formatBRL=n=>String(n);getStatus=()=>({cls:'',text:''});
      materials=[{quantity:'34.000',unit_price:'2',min_qty:'40'}, {quantity:'1.250',unit_price:'4',min_qty:'2'}, {quantity:'0.000',unit_price:'9',min_qty:'1'}].map(mapMaterialToFrontend);
      renderDashboard();`);
    assert.equal(w.document.getElementById('statTotalQty').textContent, '35,25');
    assert.equal(w.document.getElementById('statTotalValue').textContent, '73');
    assert.equal(w.document.getElementById('statZero').textContent, '1');
    assert.equal(w.document.getElementById('statCritical').textContent, '2');
  } finally { w.close(); }
});

test('map hub exposes the authenticated warehouse blueprint without copying or saving it', async () => {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const w = dom.window;
  try {
    const calls = [];
    w.API = { get: async endpoint => {
      calls.push(endpoint);
      return { success: true, data: endpoint.endsWith('map-hub') ? { maps: [] } : { name: 'Planta existente', blueprint_data: { floors: { 0: { shelves: [{ id: 'A' }] } } } } };
    }};
    let loaded = 0;
    w.loadBlueprint = async () => { loaded++; };
    const script = [...w.document.scripts].find(script => script.textContent.includes('async function loadMaps()'));
    w.eval(script.textContent);
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(w.document.getElementById('mhStatStockMaps').textContent, '1');
    assert.equal(w.document.getElementById('mhSavedCadMap').textContent, 'Planta existente');
    assert.equal(loaded, 1);
    assert.deepEqual(calls.sort(), ['/warehouse/layout', '/warehouse/map-hub']);
    assert.equal(w.document.querySelector('.eo-cad-container').style.display, 'flex');
  } finally { w.close(); }
});
