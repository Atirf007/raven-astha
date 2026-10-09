const assert = require('node:assert/strict');
const { test } = require('node:test');
const { calculateMrp } = require('../../api/services/mrp-planner');

test('MRP projects future demand, reservations, receipts and purchase packs', () => {
  const rows = calculateMrp({
    materials: [{ id: 1, code: 'M-1', description: 'Rolamento', quantity: 10, unit: 'UN', purchase_unit: 'CX', purchase_factor: 4, safety_stock: 3, reorder_point: 5, lead_time_days: 7 }],
    reservations: [{ material_id: 1, reserved_quantity: 2 }],
    forecasts: [{ material_id: 1, forecast_date: '2026-10-05', quantity: 5, source: 'manual' }],
    preventiveDemand: [{ material_id: 1, forecast_date: '2026-10-08', quantity: 4, source: 'preventive' }],
    inbound: [{ material_id: 1, expected_at: '2026-10-07', open_quantity: 2 }],
    today: '2026-10-01', until: '2026-10-31'
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].shortage_date, '2026-10-05');
  assert.equal(rows[0].order_by, '2026-09-28');
  assert.equal(rows[0].suggested_purchase_quantity, 1);
  assert.equal(rows[0].suggested_base_quantity, 4);
  assert.deepEqual(rows[0].timeline.map(event => event.projected_quantity), [8, 3, 5, 1]);
});

test('MRP omits materials without projected demand or shortage', () => {
  const rows = calculateMrp({ materials: [{ id: 2, code: 'M-2', quantity: 20, unit: 'UN', safety_stock: 2, reorder_point: 5 }], reservations: [], forecasts: [], preventiveDemand: [], inbound: [], today: '2026-10-01', until: '2026-10-31' });
  assert.deepEqual(rows, []);
});
