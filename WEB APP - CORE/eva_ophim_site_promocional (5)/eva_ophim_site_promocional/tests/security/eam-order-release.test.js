const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const calls = [];
let released = false;
const execute = async (sql, args = []) => {
  calls.push({ sql, args });
  if (sql.startsWith('SELECT status,released_at FROM maintenance_work_orders')) return [args[1] === 'tenant-a' ? [{ status: 'open', released_at: released ? '2026-09-24' : null }] : []];
  if (sql.startsWith('UPDATE maintenance_work_orders SET released_at')) { released = true; return [{ affectedRows: 1 }]; }
  if (sql.startsWith('UPDATE maintenance_work_orders SET status')) return [{ affectedRows: 1 }];
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

test('work order requires audited manager release before work starts', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/eam/work-orders/7`;
  const request = (suffix, method, tenant = 'tenant-a') => fetch(base + suffix, { method, headers: { 'content-type': 'application/json', 'x-test-org': tenant }, body: JSON.stringify(method === 'PATCH' ? { status: 'in_progress' } : {}) });
  try {
    assert.equal((await request('/status', 'PATCH')).status, 409);
    assert.equal((await request('/release', 'POST', 'tenant-b')).status, 404);
    assert.equal((await request('/release', 'POST')).status, 200);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO work_order_audit') && call.args[2] === 'released'));
    assert.equal((await request('/status', 'PATCH')).status, 200);
    assert.equal((await request('/release', 'POST')).status, 409);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
