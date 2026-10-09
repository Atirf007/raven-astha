const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
const jwt = require('../../api/node_modules/jsonwebtoken');
const express = require('../../api/node_modules/express');
const dbPath = require.resolve('../../api/database/connection');
let active = true;
let calls = [];
const pool = { execute: async (sql, args) => {
  calls.push({ sql, args });
  if (sql.includes('FROM sessions')) return [active ? [{ id: 1, email: 'a@example.invalid', role: 'viewer', org_id: 'TENANT_A', is_active: 1 }] : []];
  if (sql.includes('SELECT * FROM users')) return [[{ id: 1, email: 'a@example.invalid', role: 'admin', provider: 'google', org_id: 'TENANT_A', is_active: 1 }]];
  return [{ insertId: 1, affectedRows: 1 }];
} };
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool, readWithRetry: (...args) => pool.execute(...args) } };
const middleware = require('../../api/middleware/auth');
const app = express();
app.use(express.json());
app.get('/private', middleware, (req, res) => res.json(req.user));
app.use('/oauth', require('../../api/routes/oauth'));
let server;
const ready = new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
after(() => new Promise(resolve => server.close(resolve)));
async function request(url, opts) { await ready; return fetch(`http://127.0.0.1:${server.address().port}${url}`, opts); }
function token(claims = {}) { return jwt.sign({ id: 1, org_id: 'TENANT_A', role: 'admin', ...claims }, process.env.JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' }); }
test('SEC-001 OAuth rejects identity supplied without provider proof', async () => {
  for (const provider of ['google', 'microsoft']) {
    calls = [];
    const res = await request('/oauth/' + provider, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({email:'a@example.invalid',name:'sentinel'}) });
    assert.ok([400,401,503].includes(res.status), `unverified ${provider} identity accepted: ${res.status}`);
    assert.equal(calls.length, 0, 'unverified identity reached database');
  }
});
test('SEC-002 revoked session cannot authorize a signed token', async () => {
  active = false;
  const res = await request('/private', {headers:{authorization:'Bearer '+token()}});
  assert.equal(res.status,401);
});
test('SEC-002 current database role overrides stale token claims', async () => {
  active = true;
  const res = await request('/private', {headers:{authorization:'Bearer '+token()}});
  assert.equal(res.status,200);
  assert.equal((await res.json()).role,'viewer');
});
test('SEC-002 missing tenant is not mapped to default organization', async () => {
  active = true;
  const res = await request('/private', {headers:{authorization:'Bearer '+token({org_id:null})}});
  assert.equal(res.status,401);
});
test('SEC-002 invalid signature and anonymous requests fail', async () => {
  assert.equal((await request('/private')).status,401);
  assert.equal((await request('/private', {headers:{authorization:'Bearer sentinel.invalid.token'}})).status,401);
});
