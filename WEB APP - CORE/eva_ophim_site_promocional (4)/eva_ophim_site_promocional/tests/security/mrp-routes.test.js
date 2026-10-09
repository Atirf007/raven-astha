const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { shiftDay } = require('../../api/services/mrp-planner');

const root = path.resolve(__dirname, '../..');
const calls = [];
const execute = async (sql, args = []) => {
  calls.push({ sql, args });
  const owns = args.includes('tenant-a');
  if (sql.startsWith('SELECT m.id,m.code,m.description,m.quantity')) return [[{ id: 1, code: 'M-1', description: 'Rolamento', quantity: 10, unit: 'UN', purchase_unit: 'CX', purchase_factor: 4, safety_stock: 3, reorder_point: 5, lead_time_days: 7 }]];
  if (sql.startsWith('SELECT material_id,DATE_FORMAT(forecast_date')) return [[{ material_id: 1, forecast_date: shiftDay(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), 5), quantity: 7, source: 'manual' }]];
  if (sql.startsWith('SELECT material_id,SUM(quantity)')) return [[{ material_id: 1, reserved_quantity: 2 }]];
  if (sql.startsWith('SELECT material_id,DATE_FORMAT(expected_at')) return [[]];
  if (sql.startsWith('SELECT p.id AS plan_id')) return [[]];
  if (sql.startsWith('SELECT plan_id,DATE_FORMAT(due_date')) return [[]];
  if (sql.startsWith('SELECT id FROM materials')) return [owns ? [{ id: 1 }] : []];
  if (sql.startsWith('INSERT INTO material_demand_forecasts')) return [{ insertId: 1 }];
  if (sql.startsWith('DELETE FROM material_demand_forecasts')) return [{ affectedRows: owns ? 1 : 0 }];
  throw new Error(`Unexpected query: ${sql}`);
};
const pool = { execute, async getConnection() { return { async beginTransaction() {}, async commit() {}, async rollback() {}, release() {}, async execute(sql, args) { calls.push({ sql, args }); if (sql.startsWith('SELECT id,unit FROM materials')) return [args.includes('tenant-a') ? [{ id: 1, unit: 'UN' }] : []]; return [{ affectedRows: 1 }]; } }; } };
for (const [relative, exported] of [
  ['api/database/connection.js', { pool }],
  ['api/middleware/auth.js', (req, _res, next) => { req.user = { id: 2, org_id: req.headers['x-test-org'] || 'tenant-a' }; next(); }],
  ['api/security/authorization.js', { requireRoles: () => (_req, _res, next) => next() }]
]) {
  const filename = path.join(root, relative);
  require.cache[filename] = { id: filename, filename, loaded: true, exports: exported };
}
delete require.cache[path.join(root, 'api/routes/procurement.js')];
const express = require(path.join(root, 'api/node_modules/express'));
const app = express();app.use(express.json());app.use('/api/procurement', require(path.join(root, 'api/routes/procurement.js')));
const server = http.createServer(app);

test('MRP API projects demand and validates tenant-bound units and forecasts', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/procurement`;
  const req = (path, method, body, tenant = 'tenant-a') => fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-test-org': tenant }, body: body === undefined ? undefined : JSON.stringify(body) });
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  try {
    const planned = await req(`/planning/mrp?until=${shiftDay(today, 30)}`, 'GET');
    assert.equal(planned.status, 200);
    const rows = (await planned.json()).rows;
    assert.equal(rows[0].shortage_date, shiftDay(today, 5));
    assert.equal(rows[0].suggested_purchase_quantity, 1);
    assert.equal((await req('/planning/mrp?until=invalid', 'GET')).status, 400);
    const forecast = { material_id: 1, forecast_date: shiftDay(today, 10), quantity: 3 };
    assert.equal((await req('/planning/forecasts', 'POST', forecast)).status, 201);
    assert.equal((await req('/planning/forecasts', 'POST', forecast, 'tenant-b')).status, 404);
    assert.equal((await req('/planning/forecasts', 'POST', { ...forecast, forecast_date: '2026-02-31' })).status, 400);
    assert.equal((await req('/materials/1/units', 'POST', { purchase_unit: 'CX', factor: 4 })).status, 200);
    assert.equal((await req('/materials/1/units', 'POST', { purchase_unit: 'CX', factor: 4 }, 'tenant-b')).status, 404);
    assert.equal((await req('/materials/1/units', 'POST', { purchase_unit: 4, factor: 4 })).status, 400);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO material_unit_conversions') && call.args[0] === 'tenant-a'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
