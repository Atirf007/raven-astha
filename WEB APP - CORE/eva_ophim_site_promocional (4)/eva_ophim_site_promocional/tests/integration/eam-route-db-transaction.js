// Explicit integration test against the configured database; rolls back all writes.
if (process.env.RUN_EAM_DB_INTEGRATION !== '1') {
  console.log('EAM_ROUTE_DB_NOT_EXECUTED');
  process.exit(0);
}

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
process.chdir(path.join(root, 'api'));
const actualPool = require('../../api/database/connection').pool;
const express = require('../../api/node_modules/express');

async function run() {
  const orgId = `codex_route_${randomUUID().replace(/-/g, '').slice(0, 30)}`;
  const connection = await actualPool.getConnection();
  let server;
  try {
    await connection.beginTransaction();
    const scopedConnection = { execute: (...args) => connection.execute(...args), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
    const transactionPool = { execute: (...args) => connection.execute(...args), getConnection: async () => scopedConnection };
    for (const [relative, exports] of [
      ['api/database/connection.js', { pool: transactionPool }],
      ['api/middleware/auth.js', (req, _res, next) => { req.user = { id: 1, org_id: orgId }; next(); }],
      ['api/security/authorization.js', { requireRoles: () => (_req, _res, next) => next() }]
    ]) {
      const filename = path.join(root, relative);
      require.cache[filename] = { id: filename, filename, loaded: true, exports };
    }
    const app = express();
    app.use(express.json({ limit: '12mb' }));
    app.use('/api/eam', require('../../api/routes/eam'));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/eam/assets`;
    const post = async (url, body) => {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 201, `${url} returned ${response.status}`);
      return response.json();
    };
    const parent = await post(base, { asset_code: 'CODEX-PARENT', name: 'Ativo pai de teste', parent_asset_id: null });
    const child = await post(base, { asset_code: 'CODEX-CHILD', name: 'Ativo filho de teste', parent_asset_id: parent.id });
    const listed = await (await fetch(base)).json();
    assert.equal(listed.find(row => row.id === child.id).parent_asset_id, parent.id);
    await post(`${base}/${child.id}/visuals`, { type: 'photo', title: 'Foto de teste', filename: 'teste.png', file_data: Buffer.from([137,80,78,71,13,10,26,10]).toString('base64') });
    await post(`${base}/${child.id}/documents`, { document_number: 'CODEX-MANUAL', title: 'Manual de teste', document_type: 'manual', revision_code: 'A', filename: 'teste.pdf', file_data: Buffer.from('%PDF-1.4\n').toString('base64') });
    const planBase = `http://127.0.0.1:${server.address().port}/api/eam/plans`;
    const dueDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const plan = await post(planBase, { asset_id: parent.id, title: 'Inspeção preventiva de teste', interval_days: 30, next_due_at: dueDate });
    const initialOverview = await (await fetch(`${planBase}/overview?month=${dueDate.slice(0, 7)}&asset_id=${parent.id}`)).json();
    assert.equal(initialOverview.stats.find(row => row.plan_id === plan.id).generated_count, 0);
    const generatedResponse = await fetch(`${planBase}/run-due`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(generatedResponse.status, 200);
    const generated = await generatedResponse.json();
    assert.equal(generated.count, 1);
    const workOrderId = generated.generated[0].work_order_id;
    for (const status of ['in_progress', 'completed']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/eam/work-orders/${workOrderId}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
      assert.equal(response.status, 200);
    }
    const overview = await (await fetch(`${planBase}/overview?month=${dueDate.slice(0, 7)}&asset_id=${parent.id}`)).json();
    assert.equal(overview.stats.find(row => row.plan_id === plan.id).generated_count, 1);
    assert.equal(Number(overview.stats.find(row => row.plan_id === plan.id).completed_count), 1);
    assert.equal(overview.runs[0].work_order_status, 'completed');
    console.log('EAM_ROUTE_DB_TRANSACTION_PASS');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await connection.rollback();
    connection.release();
    const [remaining] = await actualPool.execute('SELECT COUNT(*) AS count FROM assets WHERE org_id=?', [orgId]);
    assert.equal(remaining[0].count, 0);
    await actualPool.end();
  }
}

run().catch(error => { console.error(`EAM_ROUTE_DB_TRANSACTION_FAILED:${error.code || error.name}:${error.stack?.split('\n').find(line => line.includes('eam-route-db-transaction.js'))?.trim() || ''}`); process.exitCode = 1; });
