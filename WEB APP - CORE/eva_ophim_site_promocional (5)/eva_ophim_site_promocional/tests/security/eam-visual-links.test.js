const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const calls = [];
const execute = async (sql, parameters) => {
  calls.push({ sql, parameters });
  const owns = parameters.includes('tenant-a');
  if (sql.startsWith('SELECT id,functional_location_id FROM assets')) return [owns ? [{ id: 7, functional_location_id: 12 }] : []];
  if (sql.startsWith('SELECT id FROM assets')) return [owns ? [{ id: 7 }] : []];
  if (sql.startsWith('SELECT id FROM functional_locations')) return [owns && Number(parameters[0]) === 12 ? [{ id: 12 }] : []];
  if (sql.startsWith('SELECT id FROM equipment_models')) return [owns && Number(parameters[0]) === 14 ? [{ id: 14 }] : []];
  if (sql.startsWith('WITH RECURSIVE descendants')) return [[]];
  if (sql.startsWith('SELECT id FROM equipment_modules')) return [owns && Number(parameters[0]) === 11 ? [{ id: 11 }] : []];
  if (sql.startsWith('SELECT id,module_id,filename FROM equipment_visuals')) return [owns && Number(parameters[0]) === 31 ? [{ id: 31, module_id: 11, filename: 'rotor.glb' }] : []];
  if (sql.startsWith('SELECT id FROM materials')) return [owns && Number(parameters[0]) === 19 ? [{ id: 19 }] : []];
  if (sql.startsWith('SELECT id FROM component_positions')) return [owns && ((Number(parameters[0]) === 7 && Number(parameters[1]) === 19) || (Number(parameters[0]) === 21 && Number(parameters[1]) === 7)) ? [{ id: 21 }] : []];
  if (sql.startsWith('SELECT id FROM technical_documents')) return [owns && Number(parameters[0]) === 51 ? [{ id: 51 }] : []];
  if (sql.startsWith('SELECT p.*,f.filename')) return [owns ? [{ source_type: 'material_file', source_id: 61, filename: 'bearing.step', material_id: 19, material_code: 'MAT-19' }] : []];
  if (sql.startsWith('SELECT p.*,v.title,v.filename,v.equipment_id')) return [owns ? [{ source_type: 'child_visual', source_id: 41, source_asset_id: 8, filename: 'motor.glb' }] : []];
  if (sql.startsWith('SELECT p.*,v.title')) return [owns ? [{ visual_id: 31, tx: 1, explode_dx: 3 }] : []];
  if (sql.startsWith('SELECT v.id AS source_id')) return [owns ? [{ source_type: 'child_visual', source_id: 41, source_asset_id: 8, filename: 'motor.glb', title: 'Motor' }] : []];
  if (sql.startsWith('SELECT DISTINCT f.id AS source_id')) return [owns ? [{ source_type: 'material_file', source_id: 61, material_code: 'MAT-19', filename: 'bearing.step', title: 'Rolamento' }] : []];
  if (sql.startsWith('SELECT v.filename FROM equipment_visuals v JOIN assets')) return [owns && Number(parameters[0]) === 41 ? [{ filename: 'motor.glb' }] : []];
  if (sql.startsWith('SELECT f.filename FROM material_files f JOIN materials')) return [owns && Number(parameters[0]) === 61 ? [{ filename: 'bearing.step' }] : []];
  if (sql.startsWith('UPDATE technical_documents')) return [{ affectedRows: 1 }];
  if (sql.startsWith('UPDATE assets SET') || sql.startsWith('UPDATE functional_locations SET')) return [{ affectedRows: owns ? 1 : 0 }];
  if (sql.startsWith('SELECT s.material_id FROM asset_spares')) return [owns && Number(parameters[0]) === 7 && Number(parameters[1]) === 19 ? [{ material_id: 19 }] : []];
  if (sql.startsWith('SELECT id,quantity FROM asset_spares')) return [[]];
  if (sql.startsWith('INSERT INTO')) return [{ insertId: 51 }];
  if (sql.startsWith('DELETE FROM equipment_assembly')) return [{ affectedRows: owns ? 1 : 0 }];
  if (sql.startsWith('SELECT DATE_FORMAT')) return [[{ month: '2026-09', consumed: 2, movements: 1 }]];
  if (sql.startsWith('SELECT d.started_at,d.ended_at')) return [[{started_at:new Date(Date.now()-7200000),ended_at:new Date(Date.now()-3600000),type:'corrective',work_order_id:1,production_loss_cost:40}]];
  if (sql.startsWith('SELECT h.unit_price,h.currency')) return [owns ? [{ unit_price: 32, currency: 'BRL', supplier_name: 'Fornecedor', created_at: '2026-09-01' }] : []];
  if (sql.startsWith('SELECT h.id,h.old_instance_id')) return [owns ? [{ id: 1, position_number: 'P1', old_instance_id: 2, new_instance_id: 3 }] : []];
  throw new Error(`Unrecognized statement: ${sql}`);
};
const pool = { execute, async getConnection() { return { execute, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; } };
for (const [relative, exported] of [
  ['api/database/connection.js', { pool }],
  ['api/middleware/auth.js', (request, _response, next) => { request.user = { id: 3, org_id: request.headers['x-test-org'] || 'tenant-a' }; next(); }],
  ['api/security/authorization.js', { requireRoles: () => (_request, _response, next) => next() }]
]) {
  const filename = path.join(root, relative);
  require.cache[filename] = { id: filename, filename, loaded: true, exports: exported };
}
delete require.cache[path.join(root, 'api/routes/eam.js')];
const express = require(path.join(root, 'api/node_modules/express'));
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/eam', require(path.join(root, 'api/routes/eam.js')));
app.use('/api/procurement', require(path.join(root, 'api/routes/procurement.js')));
const server = http.createServer(app);

test('visual links validate tenant, module and spare before persisting', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/eam/assets/7`;
  const post = (endpoint, body, tenant = 'tenant-a') => fetch(base + endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-org': tenant }, body: JSON.stringify(body)
  });
  try {
    const position = { position_number: 'P1', name: 'Rotor', quantity_required: 1, module_id: 11, expected_item_id: 19 };
    assert.equal((await post('/component-positions', position)).status, 201);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO component_positions') && call.parameters[2] === 11 && call.parameters[6] === 19));
    assert(calls.some(call => call.sql.startsWith('INSERT INTO asset_spares') && call.parameters[2] === 19));
    assert(calls.some(call => call.sql.startsWith('INSERT INTO asset_spare_audit') && call.parameters[3] === 'auto_add'));
    const beforeForeign = calls.filter(call => call.sql.startsWith('INSERT INTO component_positions')).length;
    assert.equal((await post('/component-positions', position, 'tenant-b')).status, 404);
    assert.equal(calls.filter(call => call.sql.startsWith('INSERT INTO component_positions')).length, beforeForeign);
    assert.equal((await post('/component-positions', { ...position, module_id: 90 })).status, 404);
    assert.equal((await post('/component-positions', { ...position, expected_item_id: 90 })).status, 404);

    const visual = { type: 'photo', title: 'Rotor', module_id: 11, filename: 'rotor.png', file_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' };
    assert.equal((await post('/visuals', visual)).status, 201);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO equipment_visuals') && call.parameters[2] === 11));
    assert.equal((await post('/visuals', { ...visual, module_id: 90 })).status, 404);

    const drawing = { document_number: 'MOTOR-EL-001', title: 'Esquema elétrico', revision_code: 'A', document_type: 'electrical', module_id: 11, filename: 'esquema.pdf', file_data: 'data:application/pdf;base64,JVBERi0xLjQKJUVPRg==' };
    const createdDrawing = await post('/documents', drawing);
    assert.equal(createdDrawing.status, 201);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO technical_documents') && call.parameters[2] === 'module' && call.parameters[3] === 11));
    assert.equal((await post('/documents', { ...drawing, module_id: 90 })).status, 404);
    const revision = await fetch(`http://127.0.0.1:${server.address().port}/api/eam/documents/51/revisions`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-org': 'tenant-a' },
      body: JSON.stringify({ revision_code: 'B', filename: drawing.filename, file_data: drawing.file_data })
    });
    assert.equal(revision.status, 201);

    const assembly = { visual_id: 31, module_id: 11, tx: 1, explode_dx: 3, anchor_x: 2, anchor_y: 3, anchor_z: 4 };
    assert.equal((await post('/assembly-parts', assembly)).status, 201);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO equipment_assembly_parts') && call.parameters[2] === 31 && call.parameters[5] === 1 && call.parameters[12] === 3 && call.parameters[15] === 2));
    assert.equal((await post('/assembly-parts', { ...assembly, visual_id: 90 })).status, 404);
    assert.equal((await post('/assembly-parts', { ...assembly, scale_factor: -1 })).status, 400);
    assert.equal((await post('/assembly-parts', { ...assembly, anchor_z: null })).status, 400);
    assert.equal((await post('/assembly-parts', assembly, 'tenant-b')).status, 404);
    const candidateResponse = await fetch(base + '/assembly-candidates', { headers: { 'x-test-org': 'tenant-a' } });
    assert.equal(candidateResponse.status, 200);
    assert.deepEqual((await candidateResponse.json()).map(row => row.source_type), ['child_visual', 'material_file']);
    assert.equal((await fetch(base + '/assembly-candidates', { headers: { 'x-test-org': 'tenant-b' } })).status, 404);
    assert.equal((await post('/assembly-sources', { source_type: 'child_visual', source_id: 41, explode_dx: 4 })).status, 201);
    assert.equal((await post('/assembly-sources', { source_type: 'material_file', source_id: 61, component_position_id: 21, explode_dx: 8 })).status, 201);
    assert.equal((await post('/assembly-sources', { source_type: 'material_file', source_id: 999 })).status, 404);
    assert.equal((await post('/assembly-sources', { source_type: 'child_visual', source_id: 41 }, 'tenant-b')).status, 404);
    assert.equal((await post('/assembly-sources', { source_type: 'child_visual', source_id: 41, scale_factor: -1 })).status, 400);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO equipment_assembly_external_parts') && call.parameters[2] === 'material_file' && call.parameters[3] === 61));
    const assembled = await fetch(base + '/assembly-parts', { headers: { 'x-test-org': 'tenant-a' } });
    assert.equal(assembled.status, 200);
    const assembledParts = await assembled.json();
    assert.equal(assembledParts.length, 3);
    assert.equal(assembledParts[0].explode_dx, 3);
    assert.equal(assembledParts[1].source_asset_id, 8);
    assert.equal(assembledParts[2].material_code, 'MAT-19');
    const remove = (path, tenant = 'tenant-a') => fetch(base + path, { method: 'DELETE', headers: { 'x-test-org': tenant } });
    assert.equal((await remove('/assembly-sources/material_file/61', 'tenant-b')).status, 404);
    assert.equal((await remove('/assembly-sources/material_file/61')).status, 200);
    assert.equal((await remove('/assembly-parts/31')).status, 200);
    assert.equal((await remove('/assembly-sources/invalid/61')).status, 400);

    const patch = (endpoint, body, tenant = 'tenant-a') => fetch(`http://127.0.0.1:${server.address().port}/api/eam${endpoint}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'x-test-org': tenant }, body: JSON.stringify(body)
    });
    const assetEdit = { name: 'Motor revisado', status: 'active', criticality: 'high', parent_asset_id: null, functional_location_id: 12, equipment_model_id: 14 };
    assert.equal((await patch('/assets/7', assetEdit)).status, 200);
    assert(calls.some(call => call.sql.startsWith('UPDATE assets SET') && call.parameters.at(-1) === 'tenant-a'));
    assert.equal((await patch('/assets/7', { ...assetEdit, functional_location_id: 99 })).status, 404);
    assert.equal((await patch('/assets/7', { ...assetEdit, parent_asset_id: 7 })).status, 400);
    assert.equal((await patch('/assets/7', assetEdit, 'tenant-b')).status, 404);
    assert.equal((await patch('/functional-locations/12', { name: 'Área revisada', parent_location_id: null, cost_center: '', work_center: '', status: 'active' })).status, 200);
    assert(calls.some(call => call.sql.startsWith('UPDATE functional_locations SET') && call.parameters.at(-1) === 'tenant-a'));
    assert.equal((await patch('/functional-locations/12', { name: 'Área revisada', status: 'invalid' })).status, 400);
    assert.equal((await patch('/functional-locations/12', { name: 'Área revisada' }, 'tenant-b')).status, 404);

    assert.equal((await post('/spares/19/requisitions', { quantity: 2, reason: 'Reposição preventiva' })).status, 201);
    const beforeForeignReq = calls.filter(call => call.sql.startsWith('INSERT INTO purchase_requisitions')).length;
    assert.equal((await post('/spares/19/requisitions', { quantity: 2, reason: 'Reposição preventiva' }, 'tenant-b')).status, 404);
    assert.equal(calls.filter(call => call.sql.startsWith('INSERT INTO purchase_requisitions')).length, beforeForeignReq);
    assert.equal((await post('/spares/19/requisitions', { quantity: -1, reason: 'Teste' })).status, 400);
    const ownUsage = await fetch(base + '/spares/19/usage', { headers: { 'x-test-org': 'tenant-a' } });
    assert.equal(ownUsage.status, 200);
    assert.equal((await ownUsage.json())[0].consumed, 2);
    assert.equal((await fetch(base + '/spares/19/usage', { headers: { 'x-test-org': 'tenant-b' } })).status, 404);
    const reliability = await fetch(base + '/spares/19/reliability', { headers: { 'x-test-org': 'tenant-a' } });
    assert.equal(reliability.status, 200);
    const metrics=await reliability.json();assert.equal(metrics.mttr_hours,null);assert.equal(metrics.failures,null);assert.equal(metrics.corrective_orders,1);
    assert.equal((await fetch(base + '/spares/19/reliability', { headers: { 'x-test-org': 'tenant-b' } })).status, 404);
    const priceHistory = await fetch(`http://127.0.0.1:${server.address().port}/api/procurement/sources/price-history?material_id=19`, { headers: { 'x-test-org': 'tenant-a' } });
    assert.equal(priceHistory.status, 200);
    assert.equal((await priceHistory.json())[0].unit_price, 32);
    assert(calls.some(call => call.sql.startsWith('SELECT h.unit_price,h.currency') && call.parameters[0] === 'tenant-a' && call.parameters[1] === 19));
    const foreignPrices = await fetch(`http://127.0.0.1:${server.address().port}/api/procurement/sources/price-history?material_id=19`, { headers: { 'x-test-org': 'tenant-b' } });
    assert.deepEqual(await foreignPrices.json(), []);
    const history = await fetch(base + '/installation-history', { headers: { 'x-test-org': 'tenant-a' } });
    assert.equal(history.status, 200);
    assert.equal((await history.json())[0].new_instance_id, 3);
    assert.equal((await fetch(base + '/installation-history', { headers: { 'x-test-org': 'tenant-b' } })).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
