'use strict';

const HOUR = 3600000;
function instant(value) {
  const time = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Instante inválido');
  return time;
}
function period(from, to) {
  const start = instant(from), end = instant(to);
  if (end <= start || end - start > 3650 * 24 * HOUR) throw new Error('Período inválido');
  return [start, end];
}
function union(intervals, window) {
  if (!Array.isArray(intervals) || intervals.length > 10000) throw new Error('Limite de intervalos excedido');
  const clipped = intervals.map(interval => {
    const start = instant(interval.started_at), end = interval.ended_at == null ? window[1] : instant(interval.ended_at);
    if (interval.ended_at != null && end <= start) throw new Error('Intervalo inválido');
    return [Math.max(start, window[0]), Math.min(end, window[1])];
  }).filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const item of clipped) {
    const last = merged.at(-1);
    if (last && item[0] <= last[1]) last[1] = Math.max(last[1], item[1]);
    else merged.push([...item]);
  }
  return merged;
}
function duration(intervals) { return intervals.reduce((sum, [start, end]) => sum + end - start, 0) / HOUR; }
function intersect(left, right) {
  let i = 0, j = 0, hours = 0;
  while (i < left.length && j < right.length) {
    hours += Math.max(0, Math.min(left[i][1], right[j][1]) - Math.max(left[i][0], right[j][0])) / HOUR;
    if (left[i][1] < right[j][1]) i++; else j++;
  }
  return hours;
}
// operationIntervals must represent observed operation, not a calendar assumption.
function exposureLedger({ from, to, downtime = [], operationIntervals = [] }) {
  const window = period(from, to), stopped = union(downtime, window), operation = union(operationIntervals, window);
  const periodHours = (window[1] - window[0]) / HOUR, stoppedHours = duration(stopped), operationHours = duration(operation);
  const conflictHours = intersect(stopped, operation);
  return {
    version: 'exposure-ledger/1', period_hours: periodHours, downtime_hours: stoppedHours,
    observed_operation_hours: operationHours, conflicting_hours: conflictHours,
    unknown_hours: Math.max(0, periodHours - stoppedHours - operationHours + conflictHours),
    calendar_available_hours: periodHours - stoppedHours,
    calendar_availability: (periodHours - stoppedHours) / periodHours,
    availability: conflictHours || !operationHours ? null : operationHours / (operationHours + stoppedHours),
    intervals: stopped.map(([start, end]) => ({ started_at: new Date(start).toISOString(), ended_at: new Date(end).toISOString() })),
    warnings: [
      ...(!operationHours ? ['Sem exposição operacional observada; tempo disponível no calendário não comprova operação.'] : []),
      ...(conflictHours ? ['Operação e parada se sobrepõem; resolva o conflito antes de calcular indicadores.'] : [])
    ]
  };
}
function legacyDowntimeReport({ from, to, rows }) {
  const ledger = exposureLedger({ from, to, downtime: rows });
  const window = period(from, to), correctiveOrders = new Set();
  let productionLoss = 0;
  for (const row of rows) {
    const start = instant(row.started_at), end = row.ended_at == null ? window[1] : instant(row.ended_at);
    if(end <= start) continue;
    if (row.type === 'corrective' && start >= window[0] && start < window[1]) correctiveOrders.add(String(row.work_order_id));
    const fraction = Math.max(0, Math.min(end, window[1]) - Math.max(start, window[0])) / (end - start);
    const cost = Number(row.production_loss_cost || 0);
    if (!Number.isFinite(cost) || cost < 0) throw new Error('Custo inválido');
    productionLoss += cost * fraction;
  }
  return {
    exposure: ledger, downtime_hours: ledger.downtime_hours, availability: null,
    calendar_availability: ledger.calendar_availability, failures: null,
    corrective_orders: correctiveOrders.size, mtbf_hours: null, mttr_hours: null,
    production_loss_cost: productionLoss,
    warnings: [...ledger.warnings, 'Ordens corretivas não equivalem a falhas qualificadas. MTBF requer eventos e exposição; MTTR requer tempo ativo de reparo.', 'Perda estimada proporcional ao intervalo de cada registro; custos duplicados devem ser reconciliados na origem.']
  };
}
module.exports = { exposureLedger, legacyDowntimeReport };
