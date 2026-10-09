// Integration regression: fresh accounts, profile persistence, tenant maps and invitation handoff.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./database/connection');

const origin = process.env.TEST_API_ORIGIN || 'http://127.0.0.1:3001';
const suffix = crypto.randomBytes(8).toString('hex');
const password = crypto.randomBytes(24).toString('base64url');
const accounts = [];

async function api(route, method = 'GET', token, body) {
  const response = await fetch(`${origin}/api${route}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function createAccount(label) {
  const email = `integration-${suffix}-${label}@example.invalid`;
  const response = await api('/auth/register', 'POST', null, {
    name: `Teste${label}`, surname: 'Isolamento', email, password,
    dob: '2000-01-02', gender: 'Outro', country: 'Brasil', phone: '11999990000'
  });
  assert.equal(response.status, 201, JSON.stringify(response.data));
  accounts.push({ id: response.data.user.id, org: response.data.user.org_id });
  return response.data;
}

async function cleanup() {
  for (const account of accounts) {
    await pool.execute('DELETE FROM sessions WHERE user_id = ?', [account.id]);
    await pool.execute('DELETE FROM audit_log WHERE user_id = ?', [account.id]);
    await pool.execute('DELETE FROM org_invites WHERE created_by = ? OR used_by = ?', [account.id, account.id]);
  }
  for (const account of accounts) await pool.execute('DELETE FROM users WHERE id = ?', [account.id]);
  for (const account of accounts) {
    await pool.execute('DELETE FROM org_units WHERE org_id = ?', [account.org]);
    await pool.execute('DELETE FROM org_map_hub WHERE org_id = ?', [account.org]);
    await pool.execute('DELETE FROM organizations WHERE id = ?', [account.org]);
  }
}

(async () => {
  try {
    const first = await createAccount('a');
    const second = await createAccount('b');
    const tokenA = first.token, tokenB = second.token;
    let result = await api('/auth/me', 'GET', tokenA);
    assert.equal(result.data.dob.slice(0, 10), '2000-01-02');
    assert.equal(result.data.gender, 'Outro');
    assert.equal(result.data.country, 'Brasil');
    assert.equal(result.data.phone, '11999990000');

    result = await api('/auth/profile', 'PUT', tokenA, { name: 'PerfilAtualizado', position_label: 'Analista' });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    result = await api('/auth/me', 'GET', tokenA);
    assert.equal(result.data.dob.slice(0, 10), '2000-01-02');
    assert.equal(result.data.phone, '11999990000');
    assert.equal(result.data.position_label, 'Analista');

    const map = { id: 'map-test', name: 'Mapa privativo', type: 'stock', imageUrl: null, sectors: [], items: [] };
    result = await api('/warehouse/map-hub', 'PUT', tokenA, { maps: [map] });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    result = await api('/warehouse/map-hub', 'GET', tokenB);
    assert.deepEqual(result.data.maps, []);
    result = await api('/warehouse/map-hub', 'GET', tokenA);
    assert.equal(result.data.maps[0].name, map.name);
    result = await api('/warehouse/map-hub', 'GET');
    assert.equal(result.status, 401);

    // A real 128px workspace thumbnail exceeds the old VARCHAR(500) column.
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/JUsAAAAASUVORK5CYII=', 'base64');
    const png = 'data:image/png;base64,' + Buffer.concat([tinyPng, Buffer.alloc(6000)]).toString('base64');
    result = await api('/org/logo', 'PUT', tokenA, { logo: png });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    result = await api('/org/me', 'GET', tokenA);
    assert.equal(result.data.logo_url, png);
    result = await api('/org/me', 'GET', tokenB);
    assert.equal(result.data.logo_url, null);

    const branch = await api('/org/units', 'POST', tokenA, { unit_type: 'branch', code: 'TEST-BRANCH', name: 'Filial Teste', image_url: png });
    assert.equal(branch.status, 201, JSON.stringify(branch.data));
    result = await api('/org/units', 'GET', tokenA);
    assert.equal(result.data[0].image_url, png);
    result = await api('/org/units', 'GET', tokenB);
    assert.deepEqual(result.data, []);
    result = await api(`/org/units/${branch.data.id}`, 'PUT', tokenB, { name: 'Outro workspace' });
    assert.equal(result.status, 404);

    result = await api('/materials', 'GET', tokenB);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(Array.isArray(result.data) ? result.data.length : result.data.materials?.length, 0);

    result = await api('/org/me', 'PUT', tokenA, { name: 'Organização Teste A', workspace_type: 'corporate' });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    result = await api('/org/complete-setup', 'POST', tokenA, {});
    assert.equal(result.status, 200, JSON.stringify(result.data));
    result = await api('/org/invites', 'POST', tokenA, { email: second.user.email, role: 'viewer', expires_hours: 1 });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    const join = await api('/org/join', 'POST', tokenB, { code: result.data.code });
    assert.equal(join.status, 200, JSON.stringify(join.data));
    assert.equal(join.data.org_id, first.user.org_id);
    result = await api('/warehouse/map-hub', 'GET', tokenB);
    assert.equal(result.status, 401);
    result = await api('/warehouse/map-hub', 'GET', join.data.token);
    assert.equal(result.data.maps[0].name, map.name);

    const invitedEmail = `integration-${suffix}-invited@example.invalid`;
    result = await api('/org/invites', 'POST', tokenA, { email: invitedEmail, role: 'viewer', expires_hours: 1 });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    const invited = await api('/auth/register', 'POST', null, {
      name: 'Convidado', email: invitedEmail, password, invite_code: result.data.code
    });
    assert.equal(invited.status, 201, JSON.stringify(invited.data));
    accounts.push({ id: invited.data.user.id, org: first.user.org_id });
    assert.equal(invited.data.user.org_id, first.user.org_id);
    result = await api('/warehouse/map-hub', 'GET', invited.data.token);
    assert.equal(result.data.maps[0].name, map.name);

    console.log('Account/profile, tenant map, workspace images, units and invitation isolation: OK');
  } finally {
    try { await cleanup(); } finally { await pool.end(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
