const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const calls = [];
let status = null;
const execute = async (sql, args = []) => {
  calls.push({ sql, args });
  if (sql.startsWith('SELECT id,asset_id,status FROM maintenance_work_orders')) return [args[1] === 'tenant-a' ? [{ id: 7, asset_id: 2, status: 'in_progress' }] : []];
  if (sql.startsWith('SELECT status FROM maintenance_work_orders')) return [args[1] === 'tenant-a' ? [{ status: 'in_progress' }] : []];
  if (sql.startsWith('SELECT id FROM materials')) return [args[1] === 'tenant-a' ? [{ id: 19 }] : []];
  if (sql.startsWith('SELECT id,status FROM work_order_material_requests')) return [status ? [{ id: 31, status }] : []];
  if (sql.startsWith('SELECT id,status,requested_quantity,issued_quantity FROM work_order_material_requests')) return [args[2] === 'tenant-a' && status ? [{ id: 31, status, requested_quantity: 3, issued_quantity: 0 }] : []];
  if (sql.startsWith('SELECT id,COALESCE(approved_quantity,requested_quantity)')) return [args[2] === 'tenant-a' && status === 'approved' ? [{ id: 31, requested_quantity: 3, issued_quantity: 0 }] : []];
  if (sql.startsWith('INSERT INTO work_order_material_requests')) { status = 'draft'; return [{ insertId: 31 }]; }
  if (sql.startsWith('UPDATE work_order_material_requests SET status=')) { status = args[0]; return [{ affectedRows: 1 }]; }
  if (sql.startsWith('INSERT INTO work_order_audit')) return [{ insertId: 1 }];
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

test('material cannot be consumed before tenant-scoped approval', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/eam/work-orders/7`;
  const request = (suffix, method, body, tenant = 'tenant-a') => fetch(base + suffix, { method, headers: { 'content-type': 'application/json', 'x-test-org': tenant }, body: JSON.stringify(body) });
  try {
    const item = { material_id: 19, quantity: 3 };
    assert.equal((await request('/materials', 'POST', item)).status, 409);
    assert.equal((await request('/material-requests', 'POST', item, 'tenant-b')).status, 404);
    assert.equal((await request('/material-requests', 'POST', item)).status, 201);
    assert.equal((await request('/materials', 'POST', item)).status, 409);
    assert.equal((await request('/material-requests/19', 'PATCH', { status: 'approved' }, 'tenant-b')).status, 409);
    assert.equal((await request('/material-requests/19', 'PATCH', { status: 'approved' })).status, 200);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO work_order_audit') && call.args[2] === 'material_approved'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
