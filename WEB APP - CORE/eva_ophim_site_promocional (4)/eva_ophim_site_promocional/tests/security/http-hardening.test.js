const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
const dbPath = require.resolve('../../api/database/connection');
const pool = { execute: async () => [[]], query: async () => [[]], getConnection: async () => ({release(){}}) };
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool, testConnection: async () => true } };
const { app } = require('../../api/server');
let server;
const ready = new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
after(() => new Promise(resolve => server.close(resolve)));
async function request(path, options) { await ready; return fetch(`http://127.0.0.1:${server.address().port}${path}`, options); }
test('SEC-005 source, schema and environment paths are not exposed', async () => {
  for (const path of ['/api/server.js', '/database/schema.sql', '/package.json', '/api/.env', '/fix_auth.js', '/old/evah/home/index.html', '/evah/home/index.html', '/js/auth.js']) {
    assert.equal((await request(path)).status, 404, path);
  }
  assert.equal((await request('/app/js/api.js')).status, 200);
});
test('SEC-005 CORS rejects untrusted and null origins', async () => {
  for (const origin of ['https://evil.example.invalid', 'null']) {
    const response = await request('/api/plans', { headers: { origin } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
});
test('SEC-005 security headers and API routes remain reachable', async () => {
  const response = await request('/api/plans');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const csp=response.headers.get('content-security-policy');
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(!csp.includes("'unsafe-eval'"));
});
test('SEC-006 future Electron builds exclude secrets', () => {
  const build = require('../../package.json').build;
  assert.ok(!build.files.includes('api/.env'));
  assert.ok(build.files.includes('!**/.env'));
});
