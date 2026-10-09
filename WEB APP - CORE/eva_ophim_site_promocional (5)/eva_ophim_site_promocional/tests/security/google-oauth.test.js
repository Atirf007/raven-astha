const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('../../api/node_modules/express');
const jwt = require('../../api/node_modules/jsonwebtoken');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.GOOGLE_CLIENT_ID = '123456789-test.apps.googleusercontent.com';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig' };
const realFetch = global.fetch;
global.fetch = (url, options) => url === 'https://www.googleapis.com/oauth2/v3/certs'
  ? Promise.resolve(new Response(JSON.stringify({ keys: [jwk] }), { status: 200 })) : realFetch(url, options);
let existing = [], failSession = false, calls = [];
const connection = {
  beginTransaction: async () => calls.push('begin'),
  commit: async () => calls.push('commit'),
  rollback: async () => calls.push('rollback'),
  release: () => calls.push('release'),
  execute: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT * FROM users')) return [existing];
    if (failSession && sql.includes('INSERT INTO sessions')) throw new Error('fixture session failure');
    return [{ insertId: 42, affectedRows: 1 }];
  }
};
const dbPath = require.resolve('../../api/database/connection');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool: { getConnection: async () => connection } } };
const app = express();
app.use(express.json());
app.use('/oauth', require('../../api/routes/oauth'));
let server;
const ready = new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
after(async () => { global.fetch = realFetch; await new Promise(resolve => server.close(resolve)); });
async function request(path, body) {
  await ready;
  return realFetch(`http://127.0.0.1:${server.address().port}/oauth/${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
}
async function nonce() { const response = await request('config'); return (await response.json()).google.nonce; }
function credential(challenge, extra = {}) {
  return jwt.sign({ sub: 'google-subject', email: 'test@example.invalid', email_verified: true, name: 'Teste', nonce: challenge, ...extra }, privateKey,
    { algorithm: 'RS256', audience: process.env.GOOGLE_CLIENT_ID, issuer: 'https://accounts.google.com', expiresIn: '5m', keyid: 'test-key' });
}
test('configuration is public, uncached and unavailable without a valid OAuth client ID', async () => {
  const valid = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'not-an-oauth-client';
  const response = await request('config');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { google: { enabled: false } });
  assert.equal((await request('google', { credential: 'invalid' })).status, 503);
  process.env.GOOGLE_CLIENT_ID = valid;
});
test('signed Google account creates a workspace owner and session atomically; replay is rejected', async () => {
  calls = []; existing = []; const challenge = await nonce();
  const body = { credential: credential(challenge), nonce: challenge };
  const response = await request('google', body);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.user.role, 'superadmin');
  assert.equal(data.user.setup_done, false);
  assert.match(data.user.org_id, /^org_/);
  assert.equal(jwt.verify(data.token, process.env.JWT_SECRET).org_id, data.user.org_id);
  assert.ok(calls.some(call => call.sql?.includes('UPDATE organizations SET owner_id')));
  assert.ok(calls.includes('commit'));
  calls = [];
  assert.equal((await request('google', body)).status, 401);
  assert.equal(calls.length, 0);
});
test('wrong nonce, unverified email, issuer and audience never reach the database', async () => {
  const challenge = await nonce();
  const variants = [
    credential(challenge, { nonce: crypto.randomBytes(32).toString('base64url') }),
    credential(challenge, { email_verified: false }),
    jwt.sign({ sub: 's', email: 'test@example.invalid', email_verified: true, nonce: challenge }, privateKey, { algorithm: 'RS256', audience: 'other-client', issuer: 'https://accounts.google.com', expiresIn: '5m', keyid: 'test-key' }),
    jwt.sign({ sub: 's', email: 'test@example.invalid', email_verified: true, nonce: challenge }, privateKey, { algorithm: 'RS256', audience: process.env.GOOGLE_CLIENT_ID, issuer: 'https://attacker.invalid', expiresIn: '5m', keyid: 'test-key' }),
    jwt.sign({ sub: 's', email: 'test@example.invalid', email_verified: true, nonce: challenge }, privateKey, { algorithm: 'RS256', audience: process.env.GOOGLE_CLIENT_ID, issuer: 'https://accounts.google.com', expiresIn: -60, keyid: 'test-key' }),
    jwt.sign({ sub: 's', email: 'test@example.invalid', email_verified: true, nonce: challenge }, 'attacker-secret', { algorithm: 'HS256', audience: process.env.GOOGLE_CLIENT_ID, issuer: 'https://accounts.google.com', expiresIn: '5m', keyid: 'test-key' }),
    'not-a-token'
  ];
  for (const token of variants) {
    calls = [];
    assert.equal((await request('google', { credential: token, nonce: challenge })).status, 401);
    assert.equal(calls.length, 0);
  }
});
test('unused challenge expires after five minutes', () => {
  const challengeStore = require('../../api/security/google-challenge');
  const value = challengeStore.issue();
  const originalNow = Date.now;
  const issuedAt = originalNow();
  try { Date.now = () => issuedAt + 6 * 60 * 1000; assert.equal(challengeStore.consume(value), false); }
  finally { Date.now = originalNow; }
});
test('existing password account cannot be linked implicitly by email', async () => {
  calls = []; existing = [{ id: 7, provider: 'local', provider_id: null, org_id: 'old-org', is_active: 1 }];
  const challenge = await nonce();
  assert.equal((await request('google', { credential: credential(challenge), nonce: challenge })).status, 401);
  assert.ok(calls.includes('rollback'));
  assert.ok(!calls.includes('commit'));
  assert.ok(!calls.some(call => call.sql?.startsWith('INSERT')));
});
test('existing Google account preserves its workspace and access role', async () => {
  calls = []; existing = [{ id: 7, name: 'Operador', email: 'test@example.invalid', provider: 'google', provider_id: 'google-subject', org_id: 'existing-org', is_active: 1, role: 'operator', setup_done: 1 }];
  const challenge = await nonce();
  const response = await request('google', { credential: credential(challenge), nonce: challenge });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.user.role, 'operator');
  assert.equal(data.user.org_id, 'existing-org');
  assert.equal(data.user.setup_done, true);
  assert.ok(!calls.some(call => call.sql?.includes('INSERT INTO organizations')));
});
test('inactive or mismatched identities are rejected without writing a session', async () => {
  for (const patch of [{ is_active: 0 }, { provider_id: 'different-subject' }]) {
    calls = [];
    existing = [{ id: 7, provider: 'google', provider_id: 'google-subject', org_id: 'existing-org', is_active: 1, ...patch }];
    const challenge = await nonce();
    assert.equal((await request('google', { credential: credential(challenge), nonce: challenge })).status, 401);
    assert.ok(!calls.some(call => call.sql?.includes('INSERT INTO sessions')));
  }
});
test('failed session creation rolls back new user and organization', async () => {
  calls = []; existing = []; failSession = true;
  const challenge = await nonce();
  assert.equal((await request('google', { credential: credential(challenge), nonce: challenge })).status, 500);
  assert.ok(calls.includes('rollback'));
  assert.ok(calls.includes('release'));
  assert.ok(!calls.includes('commit'));
  failSession = false;
});
