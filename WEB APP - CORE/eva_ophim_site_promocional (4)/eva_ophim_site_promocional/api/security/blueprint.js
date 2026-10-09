const { normalizeBlueprint, COLLECTIONS, MAX_FLOORS, MAX_ENTITIES_PER_TYPE, MAX_SHELF_LEVELS, MAX_SHELF_POSITIONS } = require('../../app/js/sistema-map-model');

const MAX_BLUEPRINT_BYTES = 1024 * 1024;
const MAX_TOTAL_ENTITIES = 10000;
const MAX_RENDER_COST = 30000;

function validateBlueprint(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Blueprint inválido');
  let encoded;
  try { encoded = JSON.stringify(value); } catch (_) { throw new Error('Blueprint inválido'); }
  if (Buffer.byteLength(encoded, 'utf8') > MAX_BLUEPRINT_BYTES) throw new Error('Blueprint excede o limite');
  const sourceFloors = value.floors && typeof value.floors === 'object' ? value.floors : {};
  let totalEntities = 0, renderCost = 0;
  if (Object.keys(sourceFloors).length > MAX_FLOORS) throw new Error('Blueprint possui andares demais');
  for (const floor of Object.values(sourceFloors)) {
    if (!floor || typeof floor !== 'object') throw new Error('Andar inválido');
    for (const collection of Object.keys(COLLECTIONS)) {
      const entities = floor[collection];
      if (entities !== undefined && !Array.isArray(entities)) throw new Error('Coleção de entidades inválida');
      if (!Array.isArray(entities)) continue;
      if (entities.length > MAX_ENTITIES_PER_TYPE) throw new Error('Blueprint possui entidades demais');
      if (entities.some(entity => !entity || typeof entity !== 'object' || Array.isArray(entity))) throw new Error('Entidade inválida');
      totalEntities += entities.length; renderCost += entities.length;
    }
    for (const shelf of Array.isArray(floor.shelves) ? floor.shelves : []) {
      if (Number(shelf && shelf.levels) > MAX_SHELF_LEVELS || Number(shelf && shelf.positions) > MAX_SHELF_POSITIONS) throw new Error('Prateleira excede os limites');
      if (Array.isArray(shelf && shelf.items) && shelf.items.length > MAX_ENTITIES_PER_TYPE) throw new Error('Prateleira possui itens demais');
      const levels=Math.min(MAX_SHELF_LEVELS,Math.max(1,Number(shelf.levels)||3));
      const positions=Math.min(MAX_SHELF_POSITIONS,Math.max(1,Number(shelf.positions)||4));
      renderCost += levels * positions + levels * 3 + (Array.isArray(shelf.items) ? shelf.items.length * 2 : 0);
    }
  }
  if (totalEntities > MAX_TOTAL_ENTITIES || renderCost > MAX_RENDER_COST) throw new Error('Blueprint excede o orçamento de renderização');
  const normalized = normalizeBlueprint(value);
  if (Object.keys(normalized.floors).length > MAX_FLOORS) throw new Error('Blueprint possui andares demais');
  for (const floor of Object.values(normalized.floors)) {
    for (const entities of Object.values(floor)) {
      if (!Array.isArray(entities) || entities.length > MAX_ENTITIES_PER_TYPE) throw new Error('Blueprint possui entidades demais');
    }
    floor.addons.forEach(addon => { addon.fileUrl = null; });
  }
  return normalized;
}

function boundedNumber(value, fallback, min, max) {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error('Dimensão inválida');
  return number;
}

module.exports = { validateBlueprint, boundedNumber, MAX_BLUEPRINT_BYTES, MAX_TOTAL_ENTITIES, MAX_RENDER_COST };
