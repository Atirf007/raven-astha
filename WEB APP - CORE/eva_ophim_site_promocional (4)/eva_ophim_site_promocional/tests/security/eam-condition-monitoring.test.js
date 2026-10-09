const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const calls = [];
let alertStatus = 'open';
let workOrderId = null;
const query = async (sql, args = []) => {
  calls.push({ sql, args });
  const tenant = args.includes('tenant-a');
  if (sql.startsWith('SELECT id FROM assets')) return [tenant ? [{ id: 3 }] : []];
  if (sql.startsWith('SELECT id,minimum_value,maximum_value,severity,unit FROM condition_rules')) return [[{ id: 8, minimum_value: null, maximum_value: 80, severity: 'critical', unit: 'C' }]];
  if (sql.startsWith('SELECT status FROM condition_alerts')) return [tenant ? [{ status: alertStatus }] : []];
  if (sql.startsWith('SELECT a.status,a.severity,a.work_order_id')) return [tenant ? [{ status: alertStatus, severity: 'critical', work_order_id: workOrderId, metric_code: 'temperature', value: 85, unit: 'C' }] : []];
  if (sql.startsWith('INSERT INTO maintenance_work_orders')) return [{ insertId: 20 }];
  if (sql.startsWith('UPDATE condition_alerts SET work_order_id')) { workOrderId = args[0];return [{ affectedRows: 1 }]; }
  if (sql.startsWith('UPDATE maintenance_work_orders SET') || sql.startsWith('INSERT INTO work_order_audit')) return [{ affectedRows: 1 }];
  if (sql.startsWith('UPDATE condition_alerts SET')) { alertStatus = args[0];return [{ affectedRows: 1 }]; }
  if (sql.startsWith('SELECT id,metric_code,unit,minimum_value')) return [[]];
  if (sql.startsWith('SELECT id,metric_code,value,unit,recorded_at')) return [[]];
  if (sql.startsWith('SELECT a.id,a.status')) return [[]];
  if (sql.startsWith('INSERT INTO condition_rules')) return [{ insertId: 8 }];
  if (sql.startsWith('INSERT INTO condition_readings')) return [{ insertId: 12 }];
  if (sql.startsWith('INSERT INTO condition_alerts')) return [{ insertId: 14 }];
  if (sql.startsWith('UPDATE condition_rules SET')) return [{ affectedRows: tenant ? 1 : 0 }];
  throw new Error(`Unexpected SQL: ${sql}`);
};
const pool = { execute: query, async getConnection() { return { execute: query, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; } };
for (const [relative, exported] of [
  ['api/database/connection.js', { pool }],
  ['api/security/authorization.js', { requireRoles: () => (_req, _res, next) => next() }]
]) { const filename = path.join(root, relative);require.cache[filename] = { id: filename, filename, loaded: true, exports: exported }; }
delete require.cache[path.join(root, 'api/routes/condition-monitoring.js')];
const express = require(path.join(root, 'api/node_modules/express'));
const app = express();app.use(express.json());app.use((req, _res, next) => { req.user = { id: 2, org_id: req.headers['x-test-org'] || 'tenant-a' }; next(); });app.use('/api/eam', require(path.join(root, 'api/routes/condition-monitoring.js')));
const server = http.createServer(app);

test('condition rules, readings and alerts stay scoped to the organization', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/eam/assets/3/condition`;
  const request = (route, method, body, org = 'tenant-a') => fetch(base + route, { method, headers: { 'content-type': 'application/json', 'x-test-org': org }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    assert.equal((await request('/rules', 'POST', { metric_code: 'temperature', unit: 'C', maximum_value: 80, severity: 'critical' }, 'tenant-b')).status, 404);
    assert.equal((await request('/rules', 'POST', { metric_code: 'temperature', unit: 'C', maximum_value: 80, severity: 'critical' })).status, 201);
    assert.equal((await request('/readings', 'POST', { metric_code: 'temperature', value: 85, unit: 'F', source: 'manual' })).status, 409);
    const reading = await request('/readings', 'POST', { metric_code: 'temperature', value: 85, unit: 'C', source: 'inspection' });
    assert.equal(reading.status, 201);
    assert.deepEqual((await reading.json()).alert_ids, [14]);
    assert.equal((await request('/alerts/14/work-order', 'POST', {}, 'tenant-b')).status, 404);
    const order = await request('/alerts/14/work-order', 'POST', {});
    assert.equal(order.status, 201);
    assert.equal((await order.json()).work_order_number, 'OS-00000020');
    assert.equal((await request('/alerts/14/work-order', 'POST', {})).status, 409);
    assert.equal((await request('/alerts/14', 'PATCH', { status: 'acknowledged' }, 'tenant-b')).status, 404);
    assert.equal((await request('/alerts/14', 'PATCH', { status: 'closed' })).status, 409);
    assert.equal((await request('/alerts/14', 'PATCH', { status: 'acknowledged' })).status, 200);
    assert.equal((await request('/alerts/14', 'PATCH', { status: 'closed' })).status, 200);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO condition_alerts') && call.args[0] === 'tenant-a'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
