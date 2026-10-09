const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const calls = [];
let currentHours = 100;
const execute = async (sql, args = []) => {
  calls.push({ sql, args });
  if (sql.startsWith('SELECT operating_hours,operating_cycles FROM assets')) return [args[1] === 'tenant-a' ? [{ operating_hours: currentHours, operating_cycles: 1000 }] : []];
  if (sql.startsWith('UPDATE assets SET operating_hours=')) { currentHours = args[0]; return [{ affectedRows: 1 }]; }
  if (sql.startsWith('INSERT INTO asset_counter_readings')) return [{ insertId: 1 }];
  throw new Error(`Unrecognized statement: ${sql}`);
};
const pool = { execute, async getConnection() { return { execute, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; } };
for (const [relative, exported] of [
  ['api/database/connection.js', { pool }],
  ['api/middleware/auth.js', (request, _response, next) => { request.user = { id: 3, org_id: request.headers['x-test-org'] || 'tenant-a' }; next(); }],
  ['api/security/authorization.js', { requireRoles: () => (_request, _response, next) => next() }],
  ['api/services/preventive-scheduler.js', { generateDuePreventives: async () => [{ plan_id: 5, work_order_id: 8 }] }]
]) {
  const filename = path.join(root, relative);
  require.cache[filename] = { id: filename, filename, loaded: true, exports: exported };
}
delete require.cache[path.join(root, 'api/routes/eam.js')];
const express = require(path.join(root, 'api/node_modules/express'));
const app = express(); app.use(express.json()); app.use('/api/eam', require(path.join(root, 'api/routes/eam.js')));
const server = http.createServer(app);

test('counter readings are monotonic, tenant scoped and trigger preventive scheduling', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/eam/assets/7/counters`;
  const post = (body, tenant = 'tenant-a') => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-org': tenant }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({ operating_hours: 99 })).status, 409);
    assert.equal((await post({ operating_hours: 101 }, 'tenant-b')).status, 404);
    assert.equal((await post({ operating_hours: -1 })).status, 400);
    const result = await post({ operating_hours: 120 });
    assert.equal(result.status, 201);
    assert.deepEqual((await result.json()).generated, [{ plan_id: 5, work_order_id: 8 }]);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO asset_counter_readings') && call.args[3] === 1000));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
