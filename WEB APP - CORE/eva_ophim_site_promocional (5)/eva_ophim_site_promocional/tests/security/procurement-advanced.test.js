const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const calls = [];
let status = 'draft';
const query = async (sql, args = []) => {
  calls.push({ sql, args });
  const owns = args.includes('tenant-a');
  if (sql.startsWith('SELECT id FROM suppliers')) return [owns ? [{ id: 4 }] : []];
  if (sql.startsWith('SELECT id FROM materials')) return [owns ? [{ id: 3 }] : []];
  if (sql.startsWith('SELECT m.unit,m.purchase_unit,c.factor FROM materials')) return [owns ? [{ unit: 'UN', purchase_unit: 'CX', factor: 4 }] : []];
  if (sql.startsWith('SELECT l.id FROM rfq_lines')) return [owns && status === 'published' ? [{ id: 9 }] : []];
  if (sql.startsWith('SELECT q.id FROM supplier_qualifications') || sql.startsWith('SELECT id FROM supplier_qualifications')) return [owns ? [{ id: 8 }] : []];
  if (sql.startsWith('SELECT status FROM request_for_quotes')) return [owns ? [{ status }] : []];
  if (sql.startsWith('UPDATE request_for_quotes SET status=?')) { status = args[0];return [{ affectedRows: 1 }]; }
  if (sql.startsWith('SELECT b.id,b.rfq_line_id')) return [owns ? [{ id: 11, rfq_line_id: 9, supplier_id: 4, material_id: 3, unit_price: 25, currency: 'BRL', lead_time_days: 7 }] : []];
  if (sql.startsWith('SELECT material_id,requested_quantity,status FROM purchase_requisitions')) return [owns ? [{ material_id: 3, requested_quantity: 4, status: 'approved' }] : []];
  if (sql.startsWith('SELECT id FROM material_sources')) return [[{ id: 15 }]];
  if (sql.startsWith('SELECT COUNT(*) AS remaining')) return [[{ remaining: 0 }]];
  if (sql.startsWith('SELECT supplier_id,quota_percent')) return [[{ supplier_id: 6, quota_percent: 70 }]];
  if (sql.startsWith('INSERT INTO request_for_quotes')) return [{ insertId: 5 }];
  if (sql.startsWith('INSERT INTO') || sql.startsWith('UPDATE')) return [{ affectedRows: 1, insertId: 5 }];
  throw new Error(`Unexpected SQL: ${sql}`);
};
const pool = { execute: query, async getConnection() { return { execute: query, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; } };
for (const [relative, exported] of [
  ['api/database/connection.js', { pool }],
  ['api/security/authorization.js', { requireRoles: () => (_request, _response, next) => next() }]
]) { const filename = path.join(root, relative);require.cache[filename] = { id: filename, filename, loaded: true, exports: exported }; }
delete require.cache[path.join(root, 'api/routes/procurement-advanced.js')];
const express = require(path.join(root, 'api/node_modules/express'));
const app = express();app.use(express.json());app.use((req, _res, next) => { req.user = { id: 2, org_id: req.headers['x-test-org'] || 'tenant-a' }; next(); });app.use('/api/procurement', require(path.join(root, 'api/routes/procurement-advanced.js')));
const server = http.createServer(app);

test('qualification, RFQ, award and quota enforce tenant and state', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/procurement`;
  const request = (route, method, body, tenant = 'tenant-a') => fetch(base + route, { method, headers: { 'content-type': 'application/json', 'x-test-org': tenant }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    assert.equal((await request('/qualifications', 'POST', { supplier_id: 4, category: 'MRO', status: 'qualified', score: 92 })).status, 200);
    assert.equal((await request('/qualifications', 'POST', { supplier_id: 4, category: 'MRO', status: 'qualified' }, 'tenant-b')).status, 404);
    assert.equal((await request('/rfqs', 'POST', { title: 'Rolamentos', lines: [{ material_id: 3, quantity: 4 }] })).status, 201);
    assert.equal((await request('/rfqs', 'POST', { title: 'Rolamentos', lines: [{ material_id: 3, quantity: 4 }] }, 'tenant-b')).status, 404);
    assert.equal((await request('/rfqs/5/status', 'PATCH', { status: 'published' })).status, 200);
    assert.equal((await request('/rfqs/5/bids', 'POST', { rfq_line_id: 9, supplier_id: 4, unit_price: 25, currency: 'BRL' })).status, 201);
    assert.equal((await request('/rfqs/5/bids', 'POST', { rfq_line_id: 9, supplier_id: 4, unit_price: 25, currency: 'BRL' }, 'tenant-b')).status, 409);
    assert.equal((await request('/rfqs/5/status', 'PATCH', { status: 'closed' })).status, 200);
    assert.equal((await request('/rfqs/5/award', 'POST', { bid_id: 11, requisition_id: 17 }, 'tenant-b')).status, 404);
    const awarded = await request('/rfqs/5/award', 'POST', { bid_id: 11, requisition_id: 17, purchase_unit: 'CX' });
    assert.equal(awarded.status, 200);
    assert.equal((await awarded.json()).purchase_order.po_number, 'MPO-00000005');
    assert.equal((await request('/quotas', 'POST', { material_id: 3, supplier_id: 4, quota_percent: 30 })).status, 200);
    assert.equal((await request('/quotas', 'POST', { material_id: 3, supplier_id: 4, quota_percent: 40 })).status, 409);
    assert(calls.some(call => call.sql.startsWith('INSERT INTO procurement_audit') && call.args[0] === 'tenant-a'));
    assert(calls.some(call => call.sql.startsWith('INSERT INTO maintenance_purchase_orders') && call.args[0] === 'tenant-a' && call.args[1] === 17));
    const purchase=calls.find(call=>call.sql.startsWith('INSERT INTO maintenance_purchase_orders'));
    assert.equal(purchase.args[5],6.25);assert.equal(purchase.args[10],'CX');assert.equal(purchase.args[11],4);assert.equal(purchase.args[12],1);
    assert(calls.some(call=>call.sql.startsWith('INSERT INTO material_sources')&&call.args[3]===6.25));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
