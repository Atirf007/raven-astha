const day = value => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || '').slice(0, 10);
};

const shiftDay = (value, offset) => {
  const date = new Date(`${day(value)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

function calculateMrp({ materials, forecasts, reservations, inbound, preventiveDemand, today, until }) {
  const byMaterial = rows => {
    const grouped = new Map();
    for (const row of rows) {
      const id = Number(row.material_id);
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(row);
    }
    return grouped;
  };
  const demandByMaterial = byMaterial([...forecasts, ...preventiveDemand]);
  const inboundByMaterial = byMaterial(inbound);
  const reservedByMaterial = new Map(reservations.map(row => [Number(row.material_id), Number(row.reserved_quantity) || 0]));
  const rows = [];
  const materialById=new Map(materials.map(material=>[Number(material.id),material]));
  for (const material of materials) {
    const id = Number(material.id);
    const events = [];
    for (const row of demandByMaterial.get(id) || []) {
      const date = day(row.forecast_date);
      if (date >= today && date <= until) events.push({ date, quantity: -(Number(row.quantity) || 0), type: row.source || 'manual', priority: row.priority || 'medium' });
    }
    for (const row of inboundByMaterial.get(id) || []) {
      const date = day(row.expected_at);
      if (date >= today && date <= until) events.push({ date, quantity: Number(row.open_quantity) || 0, type: 'purchase_order' });
    }
    const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
    events.sort((a, b) => a.date.localeCompare(b.date) || Number(b.quantity > 0) - Number(a.quantity > 0) || (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2));
    const available = Number(material.quantity) - (reservedByMaterial.get(id) || 0);
    let projected = available, minimumProjected = available;
    const threshold = Math.max(Number(material.safety_stock) || 0, Number(material.reorder_point) || 0, Number(material.bom_minimum) || 0);
    const timeline = [{ date: today, projected_quantity: Number(projected.toFixed(3)), type: 'opening' }];
    let shortageDate = projected < threshold ? today : null;
    for (const event of events) {
      const allocated = event.quantity < 0 ? Math.min(-event.quantity, Math.max(0, projected)) : 0;
      projected += event.quantity;
      minimumProjected = Math.min(minimumProjected, projected);
      timeline.push({ date: event.date, projected_quantity: Number(projected.toFixed(3)), change: Number(event.quantity.toFixed(3)), type: event.type, priority: event.priority || null, allocated_quantity: allocated, uncovered_quantity: event.quantity < 0 ? Number((-event.quantity - allocated).toFixed(3)) : 0 });
      if (!shortageDate && projected < threshold) shortageDate = event.date;
    }
    if (!shortageDate && !events.length) continue;
    const factor = Number(material.purchase_factor) > 0 ? Number(material.purchase_factor) : 1;
    const packs = shortageDate ? Math.ceil(((threshold - minimumProjected) / factor) - 1e-9) : 0;
    const lead = Math.max(0, Math.min(3650, Number(material.lead_time_days) || 0));
    rows.push({ material_id: id, code: material.code, description: material.description, base_unit: material.unit || 'UN', purchase_unit: material.purchase_unit || material.unit || 'UN', purchase_factor: factor, available_quantity: Number(available.toFixed(3)), safety_stock: Number(material.safety_stock) || 0, reorder_point: Number(material.reorder_point) || 0, lead_time_days: lead, shortage_date: shortageDate, order_by: shortageDate ? shiftDay(shortageDate, -lead) : null, suggested_purchase_quantity: packs, suggested_base_quantity: Number((packs * factor).toFixed(3)), timeline });
  }
  for(const row of rows){const material=materialById.get(row.material_id);row.bom_minimum=Number(material.bom_minimum)||0;row.bom_maximum=material.bom_maximum==null?null:Number(material.bom_maximum);row.exceeds_bom_maximum=row.bom_maximum!==null&&row.timeline.reduce((min,event)=>Math.min(min,event.projected_quantity),row.available_quantity)+row.suggested_base_quantity>row.bom_maximum;}
  return rows.sort((a, b) => (a.shortage_date || '9999').localeCompare(b.shortage_date || '9999') || a.code.localeCompare(b.code));
}

module.exports = { calculateMrp, shiftDay, day };
