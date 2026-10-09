const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

global.window = {};
const { eamPlanOccurrences, toggleEamPlanForm } = require('../../app/js/eam-preventives');
assert.deepEqual(eamPlanOccurrences({ active: 1, next_due_at: '2026-09-22', interval_days: 7 }, '2026-09'), ['2026-09-22', '2026-09-29']);
assert.deepEqual(eamPlanOccurrences({ active: 1, next_due_at: '2026-08-28', interval_days: 7 }, '2026-09'), ['2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25']);
assert.deepEqual(eamPlanOccurrences({ active: 0, next_due_at: '2026-09-22', interval_days: 7 }, '2026-09'), []);
assert.deepEqual(eamPlanOccurrences({ active: 1, next_due_at: '2026-09-22', interval_days: 1 }, '2026-09').length, 9);
const form = { hidden: true }, prerequisite = { hidden: true }, submit = { disabled: false }, assetSelect = { value: '' }, assetButton = { focused: false, focus() { this.focused = true; } }, title = { focused: false, focus() { this.focused = true; } };
global.document = { getElementById: id => ({ eamPlanForm: form, eamPlanAsset: assetSelect, eamPlanNoAssets: prerequisite, eamPlanSubmit: submit, eamPlanTitle: title })[id], querySelector: () => assetButton };
toggleEamPlanForm(true);
assert.equal(form.hidden, false);
assert.equal(prerequisite.hidden, false);
assert.equal(submit.disabled, true);
assert.equal(assetButton.focused, true);
window.eamPlanState.assets = [{ id: 1 }];
toggleEamPlanForm(true);
assert.equal(prerequisite.hidden, true);
assert.equal(submit.disabled, false);
assert.equal(title.focused, true);

const markup = fs.readFileSync(path.join(__dirname, '../../app/sistema.html'), 'utf8');
for (const id of ['eamPlanFilterAsset', 'eamPlanCalendar', 'eamPlanMetrics', 'eamPlanDayItems', 'eamPlanForm']) assert(markup.includes(`id="${id}"`));

const root = path.resolve(__dirname, '../..');
const calls = [];
const pool = { async execute(sql, params) {
  calls.push({ sql, params });
  if (sql.startsWith('SELECT id FROM assets')) return [params[0] === 5 && params[1] === 'tenant-a' ? [{ id: 5 }] : []];
  if (sql.includes('COUNT(r.id)')) return [[{ plan_id: 8, asset_id: 5, generated_count: 2, completed_count: 1 }]];
  if (sql.includes('DATE_FORMAT(r.due_date')) return [[{ plan_id: 8, asset_id: 5, due_date: '2026-09-22', work_order_status: 'completed' }]];
  throw Error('Unexpected query');
} };
for (const [relative, exports] of [
  ['api/database/connection.js', { pool }],
  ['api/middleware/auth.js', (req, _res, next) => { req.user = { id: 1, org_id: req.headers['x-test-org'] || 'tenant-a' }; next(); }],
  ['api/security/authorization.js', { requireRoles: () => (_req, _res, next) => next() }]
]) {
  const filename = path.join(root, relative);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const express = require('../../api/node_modules/express');
const app = express();
app.use('/api/eam', require('../../api/routes/eam'));
const server = http.createServer(app);
async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/eam/plans/overview`;
    assert.equal((await fetch(`${base}?month=2026-13`)).status, 400);
    assert.equal((await fetch(`${base}?month=2026-09&asset_id=abc`)).status, 400);
    assert.equal((await fetch(`${base}?month=2026-09&asset_id=5`, { headers: { 'x-test-org': 'tenant-b' } })).status, 404);
    const response = await fetch(`${base}?month=2026-09&asset_id=5`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.stats[0].completed_count, 1);
    assert.equal(data.runs[0].work_order_status, 'completed');
    assert(calls.filter(call => call.sql.includes('COUNT(r.id)') || call.sql.includes('DATE_FORMAT(r.due_date')).every(call => call.params.includes('tenant-a') && !call.params.includes('tenant-b')));
    console.log('EAM_PREVENTIVES_PASS');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
