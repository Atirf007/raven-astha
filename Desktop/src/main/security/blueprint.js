const { normalizeBlueprint, COLLECTIONS, MAX_FLOORS, MAX_ENTITIES_PER_TYPE, MAX_SHELF_LEVELS, MAX_SHELF_POSITIONS } = require('../../renderer/js/sistema-map-model');

const industrial = require('../../renderer/js/sistema-industrial-rules');

const MAX_BLUEPRINT_BYTES = 1024 * 1024;
const MAX_TOTAL_ENTITIES = 10000;
const MAX_RENDER_COST = 30000;

function validateBlueprint(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Blueprint inválido');
  let encoded;
  try { encoded = JSON.stringify(value); } catch (_) { throw new Error('Blueprint inválido'); }
  if (Buffer.byteLength(encoded, 'utf8') > MAX_BLUEPRINT_BYTES) throw new Error('Blueprint excede o limite');
  const prepared=JSON.parse(encoded);
  const sourceFloors = prepared.floors && typeof prepared.floors === 'object' ? prepared.floors : {};
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
      for(const entity of entities){
        if(industrial.descriptor(entity)||String(entity.modelId||entity.machineType||'').startsWith('ASTHA-3D-')){
          if(collection!=='machines')throw new Error('Modelo industrial em coleção incompatível');
          const scale=value.units==='m'?100:1;
          const validated=industrial.validate({...entity,w:entity.w===undefined?undefined:Number(entity.w)*scale,h:entity.h===undefined?undefined:Number(entity.h)*scale,height3d:entity.height3d===undefined?undefined:Number(entity.height3d)*scale,elevation:entity.elevation===undefined?undefined:Number(entity.elevation)*scale,operationClearance:entity.operationClearance===undefined?undefined:Number(entity.operationClearance)*scale,maintenanceClearance:entity.maintenanceClearance===undefined?undefined:Number(entity.maintenanceClearance)*scale});
          Object.assign(entity,validated,{w:validated.w/scale,h:validated.h/scale,height3d:validated.height3d/scale,elevation:validated.elevation/scale,operationClearance:validated.operationClearance/scale,maintenanceClearance:validated.maintenanceClearance/scale});
          renderCost += 15+(validated.parameters.levels||1)*(validated.parameters.modules||1)+(validated.parameters.rollers||0)+(validated.parameters.steps||0);
        }
        if(entity.importId!=null&&(!Number.isSafeInteger(entity.importId)||entity.importId<1))throw Error('Modelo importado inválido');
        if(entity.linkedAssetId!=null&&(!Number.isSafeInteger(entity.linkedAssetId)||entity.linkedAssetId<1))throw Error('Ativo inválido');
        if(entity.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(entity.color))throw Error('Cor inválida');
      }
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
  const normalized = normalizeBlueprint(prepared);
  const shelfIds=new Set(),industrialIds=new Set();
  for(const floor of Object.values(normalized.floors))for(const item of Object.values(floor).flat())if(industrial.descriptor(item)){if(industrialIds.has(item.id))throw Error('Objetos industriais precisam de IDs únicos no mapa');industrialIds.add(item.id);}
  for(const floor of Object.values(normalized.floors))for(const shelf of floor.shelves){
    if(shelfIds.has(shelf.id))throw new Error('Cada prateleira deve ter um código único no mapa.');
    shelfIds.add(shelf.id);
    if(shelf.warehouse_id!=null&&(!Number.isSafeInteger(Number(shelf.warehouse_id))||Number(shelf.warehouse_id)<1))throw new Error('Estoque da prateleira inválido.');
  }
  if (Object.keys(normalized.floors).length > MAX_FLOORS) throw new Error('Blueprint possui andares demais');
  for (const floor of Object.values(normalized.floors)) {
    for (const entities of Object.values(floor)) {
      if (!Array.isArray(entities) || entities.length > MAX_ENTITIES_PER_TYPE) throw new Error('Blueprint possui entidades demais');
    }
    for(const key of Object.keys(COLLECTIONS))floor[key]=floor[key].map(entity=>industrial.validate(entity));
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
