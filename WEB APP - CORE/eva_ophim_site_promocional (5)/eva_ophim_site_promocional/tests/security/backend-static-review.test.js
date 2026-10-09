const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
function source(path) { return fs.readFileSync(path, 'utf8'); }
test('SEC-003 movement queries bind tenant and lock stock rows', () => {
  const s = source('api/routes/movements.js');
  assert.match(s, /mat\.org_id = \?/);
  assert.match(s, /code = \? AND org_id = \? FOR UPDATE/);
  assert.match(s, /quantity >= \?/);
});
test('SEC-004 material mutations enforce server-side roles and tenant reads', () => {
  const s = source('api/routes/materials.js');
  assert.match(s, /router\.post\('\/', requireRoles/);
  assert.match(s, /router\.put\('\/:code', requireRoles/);
  assert.match(s, /id = \? AND org_id = \?/);
  assert.doesNotMatch(s, /Erro ao criar material: \$\{err\.message\}/);
});
test('SEC-007 invite roles, email binding and atomic claim are enforced', () => {
  const auth = source('api/routes/auth.js');
  const org = source('api/routes/organizations.js');
  assert.match(auth, /invite\.email.*normalizedEmail/);
  assert.match(auth, /used_at = NOW\(\).*used_at IS NULL/);
  assert.match(org, /allowedInviteRoles/);
});
