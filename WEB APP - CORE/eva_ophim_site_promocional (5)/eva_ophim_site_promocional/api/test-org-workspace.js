// Isolated integration smoke test; it never touches a real organization's rows.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { pool } = require('./database/connection');
const ensureOrgWorkspace = require('./database/ensure_org_workspace');

const orgId = `test-${crypto.randomUUID()}`;
const fakeUser = { id: 1, org_id: orgId, role: 'admin' };
const authPath = require.resolve('./middleware/auth');
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: (req, _res, next) => { req.user = fakeUser; next(); } };
const routes = require('./routes/org-workspace');
const groupAccess = require('./middleware/groupAccess');

async function run() {
  await ensureOrgWorkspace();
  const app = express();
  app.use(express.json());
  app.use('/org', routes);
  app.get('/check-wms', groupAccess('wms'), (_req, res) => res.json({ ok: true }));
  app.post('/check-wms', groupAccess('wms'), (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(method, path, body) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  try {
    assert.deepEqual((await call('GET', '/org/units')).body, []);
    const branch = await call('POST', '/org/units', { unit_type: 'branch', code: 'B1', name: 'Filial teste', legal_name: 'Filial Teste Ltda.', tax_id: '12.345.678/0001-90', city: 'São Paulo', state: 'SP' });
    assert.equal(branch.status, 201);
    assert.equal((await call('GET', '/org/units')).body[0].legal_name, 'Filial Teste Ltda.');
    const center = await call('POST', '/org/units', { unit_type: 'cost_center', code: 'CC1', name: 'Centro teste', parent_id: branch.body.id });
    assert.equal(center.status, 201);
    assert.equal((await call('GET', `/org/cost-centers/${center.body.id}/summary`)).body.total_cost, 0);
    const location = await call('POST', '/org/units', { unit_type: 'location', code: 'LOC1', name: 'Local teste', parent_id: center.body.id });
    assert.equal(location.status, 201);
    assert.equal((await call('GET', '/org/units')).body.length, 3);
    const [locations] = await pool.execute('SELECT cost_center FROM functional_locations WHERE id=? AND org_id=?', [location.body.functional_location_id, orgId]);
    assert.equal(locations[0].cost_center, 'CC1');
    const centerEdit = await call('PUT', `/org/units/${center.body.id}`, { code: 'CC2' });
    assert.equal(centerEdit.status, 200);
    const [updated] = await pool.execute('SELECT cost_center FROM functional_locations WHERE id=? AND org_id=?', [location.body.functional_location_id, orgId]);
    assert.equal(updated[0].cost_center, 'CC2');
    assert.equal((await call('POST', '/org/units', { unit_type: 'branch', code: 'B2', name: 'Inválida', parent_id: center.body.id })).status, 400);

    const group = await call('POST', '/org/groups', { code: 'G1', name: 'Leitores WMS', permissions: { wms: { read: true, write: false } } });
    assert.equal(group.status, 201);
    assert.equal((await call('GET', '/org/groups')).body.groups.length, 1);
    await pool.execute('INSERT INTO org_access_group_members (org_id,group_id,user_id) VALUES (?,?,?)', [orgId, group.body.id, fakeUser.id]);
    fakeUser.role = 'operator';
    assert.equal((await call('GET', '/org/access/me')).body.permissions.wms.read, true);
    assert.equal((await call('GET', '/check-wms')).status, 200);
    assert.equal((await call('POST', '/check-wms')).status, 403);
    fakeUser.role = 'admin';
    assert.equal((await call('DELETE', `/org/groups/${group.body.id}`)).status, 200);
    assert.equal((await call('DELETE', `/org/units/${branch.body.id}`)).status, 409);
    assert.equal((await call('DELETE', `/org/units/${location.body.id}`)).status, 200);
    assert.equal((await call('DELETE', `/org/units/${center.body.id}`)).status, 200);
    assert.equal((await call('DELETE', `/org/units/${branch.body.id}`)).status, 200);
    console.log('Workspace: CRUD, centro de custo/EAM, hierarquia e grupos verificados.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await pool.execute('DELETE FROM org_access_group_members WHERE org_id=?', [orgId]);
    await pool.execute('DELETE FROM org_access_groups WHERE org_id=?', [orgId]);
    await pool.execute('DELETE FROM org_units WHERE org_id=?', [orgId]);
    await pool.execute('DELETE FROM functional_locations WHERE org_id=?', [orgId]);
    await pool.end();
  }
}

run().catch(error => { console.error(error.message); process.exitCode = 1; });
