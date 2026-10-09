const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const statements = [];
let saved = { id: 19, code: 'PECA-001', description: 'Rotor', origin_country: 'Brasil' };
const pool = { async execute(sql, params) {
  statements.push({ sql, params });
  if (sql.startsWith('INSERT INTO materials')) return [{ insertId: 19 }];
  if (sql.startsWith('SELECT id FROM materials')) return [[{ id: 19 }]];
  if (sql.startsWith('UPDATE materials')) { saved = { ...saved, origin_country: params[0] }; return [{ affectedRows: 1 }]; }
  if (sql.startsWith('SELECT * FROM materials')) return [[saved]];
  throw Error(`Unexpected SQL: ${sql}`);
} };
for (const [relative, exported] of [
  ['api/database/connection.js', { pool }],
  ['api/middleware/auth.js', (request, _response, next) => { request.user = { id: 3, org_id: 'tenant-a' }; next(); }],
  ['api/security/authorization.js', { requireRoles: () => (_request, _response, next) => next() }]
]) {
  const filename = path.join(root, relative);
  require.cache[filename] = { id: filename, filename, loaded: true, exports: exported };
}
delete require.cache[path.join(root, 'api/routes/materials.js')];
const express = require(path.join(root, 'api/node_modules/express'));
const app = express(); app.use(express.json()); app.use('/api/materials', require(path.join(root, 'api/routes/materials.js')));
const server = http.createServer(app);

test('material origin is persisted and bounded in the authenticated tenant', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/materials`;
  const request = (method, url, body) => fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await request('POST', base, { code: 'PECA-001', description: 'Rotor', origin_country: 'Brasil' })).status, 201);
    const insert = statements.find(entry => entry.sql.startsWith('INSERT INTO materials'));
    assert(insert.sql.includes('origin_country'));
    assert(insert.params.includes('Brasil'));
    assert(insert.params.includes('tenant-a'));
    assert.equal((await request('POST', base, { code: 'PECA-002', description: 'Rotor', origin_country: 'x'.repeat(101) })).status, 400);
    const changed = await request('PUT', base + '/PECA-001', { origin_country: 'Alemanha' });
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).origin_country, 'Alemanha');
    assert.equal((await request('PUT', base + '/PECA-001', { origin_country: 42 })).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
