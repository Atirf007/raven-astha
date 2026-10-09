const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const calls = [];
const execute = async (sql, args = []) => {
  calls.push({ sql, args });
  if (sql.startsWith('SELECT p.id,p.asset_id,p.title,p.interval_days')) return [[{ id: 3, asset_id: 7, title: 'Revisão', interval_days: 30, next_due_at: '2026-09-24', run_due_at: '2026-09-24', operating_hours: 100, operating_cycles: 1000 }]];
  if (sql.startsWith('INSERT IGNORE INTO preventive_plan_runs')) return [{ affectedRows: 1 }];
  if (sql.startsWith('INSERT INTO maintenance_work_orders')) return [{ insertId: 42 }];
  if (sql.startsWith('SELECT title FROM preventive_plan_tasks')) return [[{ title: 'Inspecionar' }]];
  if (sql.startsWith('SELECT material_id,quantity FROM asset_spares')) return [[{ material_id: 19, quantity: 2 }, { material_id: 20, quantity: 5 }]];
  if (sql.startsWith('SELECT quantity FROM materials')) return [[{ quantity: args[0] === 19 ? 10 : 1 }]];
  if (sql.startsWith('SELECT COALESCE(SUM(quantity),0) AS quantity')) return [[{ quantity: 0 }]];
  if (sql.startsWith('UPDATE') || sql.startsWith('INSERT INTO')) return [{ affectedRows: 1, insertId: 1 }];
  throw new Error(`Unrecognized statement: ${sql}`);
};
const filename = path.join(root, 'api/database/connection.js');
require.cache[filename] = { id: filename, filename, loaded: true, exports: { pool: { async getConnection() { return { execute, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; } } } };
delete require.cache[path.join(root, 'api/services/preventive-scheduler.js')];
const { generateDuePreventives } = require(path.join(root, 'api/services/preventive-scheduler.js'));

test('generated preventive order copies tasks and handles spare stock and shortage', async () => {
  const generated = await generateDuePreventives('tenant-a', 5);
  assert.deepEqual(generated, [{ plan_id: 3, work_order_id: 42 }]);
  assert(calls.some(call => call.sql.startsWith('INSERT INTO work_order_tasks') && call.args[2] === 'Inspecionar'));
  assert(calls.some(call => call.sql.startsWith('INSERT INTO inventory_reservations') && call.args[2] === 19));
  assert(calls.some(call => call.sql.startsWith('INSERT INTO purchase_requisitions') && call.args[2] === 20 && call.args[3] === 4));
  assert(calls.some(call => call.sql.startsWith('UPDATE maintenance_work_orders SET work_order_number')));
});
