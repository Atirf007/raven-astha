const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'app/js/sistema-core.js'), 'utf8');
const markup = fs.readFileSync(path.join(root, 'app/sistema.html'), 'utf8');
for (const id of ['eamAssetTab-basic', 'eamAssetTab-visual', 'eamAssetTab-machine', 'eamAssetTab-documents', 'eamAssetKind', 'eamAssetParent', 'eamAssetPhoto', 'eamAsset3D', 'eamAssetManuals', 'eamAssetElectrical', 'eamAssetMechanical']) {
  assert(markup.includes(`id="${id}"`), `${id} must be available in the asset modal`);
}
const fields = Object.fromEntries(Object.entries({
  eamAssetCode: 'PUMP-001', eamAssetName: 'Bomba principal', eamAssetKind: 'root',
  eamAssetParent: '', eamAssetFunctionalLocation: '', eamAssetEquipmentModel: '',
  eamAssetCriticality: 'high', eamAssetStatus: 'active', eamAssetManufacturer: 'WEG',
  eamAssetModel: 'M1', eamAssetSerial: 'SN-1', eamAssetManufacturerUrl: 'https://example.invalid',
  eamAssetMachineDescription: 'Bomba de processo', eamAssetNotes: 'Inspecionar mensalmente'
}).map(([id, value]) => [id, { value }]));
const context = vm.createContext({
  document: { getElementById: id => fields[id], addEventListener() {} },
  window: {}, console, setTimeout, URL
});
vm.runInContext(source, context, { filename: 'sistema-core.js' });
fields.eamAssetParentGroup = { hidden: true };
fields.eamAssetParentHint = { textContent: '' };
context.toggleEamAssetParent();
assert.equal(fields.eamAssetParentGroup.hidden, true);
const rootPayload = context.eamAssetCreatePayload();
assert.equal(rootPayload.parent_asset_id, null);
assert.equal(rootPayload.metadata.technical_notes, 'Inspecionar mensalmente');
fields.eamAssetKind.value = 'child';
context.toggleEamAssetParent();
assert.equal(fields.eamAssetParentGroup.hidden, false);
assert.throws(() => context.eamAssetCreatePayload(), /Selecione um ativo pai/);
fields.eamAssetParent.value = 'invalid';
assert.throws(() => context.eamAssetCreatePayload(), /Ativo pai inválido/);
fields.eamAssetParent.value = '41';
fields.eamAssetCode.value = 'PUMP-001-MOTOR';
const childPayload = context.eamAssetCreatePayload();
assert.equal(childPayload.parent_asset_id, 41);
fields.eamAssetManufacturerUrl.value = 'http://insecure.invalid';
assert.throws(() => context.eamAssetCreatePayload(), /HTTPS/);
fields.eamAssetManufacturerUrl.value = 'https://example.invalid';

let nextId = 41;
const assets = [];
const statements = [];
async function execute(sql, params) {
  statements.push({ sql, params });
  if (sql.startsWith('SELECT id FROM assets WHERE id =') || sql.startsWith('SELECT id FROM assets WHERE id=?')) return [assets.filter(a => a.id === params[0] && a.org_id === params[1])];
  if (sql.startsWith('INSERT INTO assets')) {
    const id = nextId++;
    assets.push({ id, org_id: params[0], asset_code: params[1], name: params[2], parent_asset_id: params[14] });
    return [{ insertId: id }];
  }
  if (sql.startsWith('SELECT a.*')) return [assets.filter(a => a.org_id === params[0])];
  if (sql.startsWith('INSERT INTO equipment_visuals') || sql.startsWith('INSERT INTO technical_documents') || sql.startsWith('INSERT INTO technical_document_revisions')) return [{ insertId: 100 + statements.length }];
  if (sql.startsWith('UPDATE technical_documents')) return [{ affectedRows: 1 }];
  throw Error(`Unexpected SQL: ${sql}`);
}
const pool = { execute, async getConnection() { return { execute, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; } };
for (const [relative, exports] of [
  ['api/database/connection.js', { pool }],
  ['api/middleware/auth.js', (req, _res, next) => { req.user = { id: 1, org_id: req.headers['x-test-org'] || 'tenant-a' }; next(); }],
  ['api/security/authorization.js', { requireRoles: () => (_req, _res, next) => next() }]
]) {
  const filename = path.join(root, relative);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const express = require(path.join(root, 'api/node_modules/express'));
const app = express();
app.use(express.json());
app.use('/api/eam', require(path.join(root, 'api/routes/eam.js')));
const server = http.createServer(app);

async function run() {
  const uploads = [];
  context.readEamVisualFile = async () => 'data:application/pdf;base64,JVBERi0xLjQK';
  context.API = { post: async (endpoint, payload) => { uploads.push({ endpoint, payload }); return { success: true }; } };
  const failed = await context.uploadEamAssetCreateFiles(42, 'PUMP-001', [
    { file: { name: 'foto.png' }, kind: 'visual', type: 'photo' },
    { file: { name: 'manual.pdf' }, kind: 'document', type: 'manual' }
  ]);
  assert.equal(failed.length, 0);
  assert.equal(uploads[0].endpoint, '/eam/assets/42/visuals');
  assert.equal(uploads[0].payload.type, 'photo');
  assert.equal(uploads[1].endpoint, '/eam/assets/42/documents');
  assert.equal(uploads[1].payload.document_type, 'manual');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/eam/assets`;
  const post = (body, org = 'tenant-a') => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-org': org }, body: JSON.stringify(body) });
  try {
    const parent = await post(rootPayload);
    assert.equal(parent.status, 201);
    assert.equal((await parent.json()).id, 41);
    const child = await post(childPayload);
    assert.equal(child.status, 201);
    const listed = await (await fetch(base, { headers: { 'x-test-org': 'tenant-a' } })).json();
    assert.equal(listed.find(a => a.asset_code === 'PUMP-001-MOTOR').parent_asset_id, 41);
    const otherTenant = await post({ ...childPayload, asset_code: 'TENANT-B-CHILD' }, 'tenant-b');
    assert.equal(otherTenant.status, 404);
    assert.equal(assets.length, 2);
    const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64');
    const photo = await fetch(`${base}/41/visuals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'photo', title: 'Foto', filename: 'foto.png', file_data: png }) });
    assert.equal(photo.status, 201);
    const foreignPhoto = await fetch(`${base}/41/visuals`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-org': 'tenant-b' }, body: JSON.stringify({ type: 'photo', title: 'Foto', filename: 'foto.png', file_data: png }) });
    assert.equal(foreignPhoto.status, 404);
    const manual = await fetch(`${base}/41/documents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document_number: 'PUMP-001-manual-1', title: 'Manual', revision_code: 'A', document_type: 'manual', filename: 'manual.pdf', file_data: Buffer.from('%PDF-1.4\n').toString('base64') }) });
    assert.equal(manual.status, 201);
    assert(statements.some(item => item.sql.startsWith('INSERT INTO assets') && item.params[14] === null));
    assert(statements.some(item => item.sql.startsWith('INSERT INTO assets') && item.params[14] === 41));
    assert(statements.some(item => item.sql.startsWith('INSERT INTO equipment_visuals')));
    assert(statements.some(item => item.sql.startsWith('INSERT INTO technical_document_revisions')));
    console.log('EAM_ASSET_CREATE_PASS');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
