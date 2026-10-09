const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const calls = [];
const execute = async (sql, args = []) => {
  calls.push({ sql, args });
  if (sql.includes('FROM asset_observations')) return [[]];
  if (sql.startsWith('INSERT INTO failure_classifications')) return [{ insertId: 9 }];
  if (sql.startsWith('SELECT id,code,name,category,is_active FROM failure_classifications')) return [args[0] === 'tenant-a' ? [{ id: 9, code: 'BRG', name: 'Rolamento', category: 'cause', is_active: 1 }] : []];
  if (sql.startsWith('UPDATE failure_classifications')) return [{ affectedRows: args.at(-1) === 'tenant-a' ? 1 : 0 }];
  if (sql.startsWith('SELECT id FROM assets')) return [args[0] === 7 && args[1] === 'tenant-a' ? [{id:7}] : []];
  if (sql.startsWith('SELECT d.started_at')) return [[{started_at:new Date('2026-08-31T23:00:00Z'),ended_at:new Date('2026-09-01T02:00:00Z'),work_order_id:1,type:'corrective',production_loss_cost:30}]];
  if (sql.startsWith('SELECT COALESCE(SUM(wom.material_cost)')) return [[{material_cost:20}]];
  if (sql.startsWith('SELECT COUNT(*) AS completed_waits')) return [[{completed_waits:0,mtws_hours:null}]];
  if (sql.startsWith('SELECT id,asset_code,name,status FROM assets')) return [args[0] === 'tenant-a' ? [{ id: 7, asset_code: 'A-7', name: 'Motor', status: 'active' }] : []];
  if (sql.startsWith('SELECT d.asset_id,d.started_at')) return [args[0] === 'tenant-a' ? [
    {asset_id:7,started_at:new Date('2026-09-01T08:00:00Z'),ended_at:new Date('2026-09-01T10:00:00Z'),type:'corrective',work_order_id:1,production_loss_cost:40},
    {asset_id:7,started_at:new Date('2026-09-01T09:00:00Z'),ended_at:new Date('2026-09-01T11:00:00Z'),type:'preventive',work_order_id:2,production_loss_cost:40}
  ] : []];
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
const app = express(); app.use(express.json()); app.use('/api/eam', require(path.join(root, 'api/routes/eam.js')));
const server = http.createServer(app);

test('failure codes and consolidated reliability stay within the organization', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/eam/reliability`;
  const request = (url, options = {}) => fetch(base + url, { headers: { 'content-type': 'application/json', 'x-test-org': options.tenant || 'tenant-a' }, method: options.method || 'GET', body: options.body ? JSON.stringify(options.body) : undefined });
  try {
    assert.equal((await request('/failure-codes', { method: 'POST', body: { code: 'BRG', name: 'Rolamento', category: 'cause' } })).status, 201);
    assert.equal((await request('/failure-codes', { method: 'POST', body: { code: 'BRG', name: 'Rolamento', category: 'other' } })).status, 400);
    assert.deepEqual((await (await request('/failure-codes', { tenant: 'tenant-b' })).json()), []);
    assert.equal((await request('/failure-codes/9', { method: 'PATCH', tenant: 'tenant-b', body: { is_active: false } })).status, 404);
    const report = await request('/summary?from=2026-09-01&to=2026-09-30');
    assert.equal(report.status, 200);
    const asset=(await report.json()).assets[0];
    assert.equal(asset.failures,null);assert.equal(asset.corrective_orders,1);
    assert.equal(asset.downtime_hours,3);assert.equal(asset.mtbf_hours,null);
    assert.deepEqual((await (await request('/summary?from=2026-09-01&to=2026-09-30', { tenant: 'tenant-b' })).json()).assets, []);
    const detail=await request('/assets/7?from=2026-09-01&to=2026-09-02');assert.equal(detail.status,200);
    const data=await detail.json();assert.equal(data.downtime_hours,2);assert.equal(data.exposure.unknown_hours,22);assert.equal(data.production_loss_cost,20);assert.equal(data.tco,40);assert.equal(data.corrective_orders,0);
    assert.equal((await request('/assets/7?from=2026-09-01&to=2026-09-02',{tenant:'tenant-b'})).status,404);
    const forecast=await request('/poisson?asset_id=7&from=2026-09-01&to=2026-09-02');assert.equal(forecast.status,200);assert.equal((await forecast.json()).supported,false);
    assert.equal((await request('/poisson?asset_id=7&from=2026-09-01&to=2026-09-02',{tenant:'tenant-b'})).status,404);
    assert.equal((await request('/assets/7?from=2026-09-01&to=2050-09-01')).status,400);
    assert(calls.some(call => call.sql.startsWith('SELECT d.asset_id') && call.args[0] === 'tenant-a' && call.sql.includes('d.started_at<?')));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
