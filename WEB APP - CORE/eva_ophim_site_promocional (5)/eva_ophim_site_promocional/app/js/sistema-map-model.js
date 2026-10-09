/* Canonical, data-only blueprint model shared by the 2D and 3D map views. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ASTHAMapModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const SCHEMA_VERSION = 2;
  const MAX_FLOORS = 20;
  const MAX_ENTITIES_PER_TYPE = 2000;
  const MAX_SHELF_LEVELS = 20;
  const MAX_SHELF_POSITIONS = 100;
  const COLLECTIONS = Object.freeze({
    walls: 'wall', doors: 'door', windows: 'window', pillars: 'pillar',
    shelves: 'shelf', stairs: 'stairs', zones: 'zone', paths: 'path',
    machines: 'machine', forklifts: 'forklift', docks: 'dock', addons: 'addon'
  });

  function finite(value, fallback, min = -100000, max = 100000) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }

  function text(value, fallback = '', max = 120) {
    return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
  }

  function normalizeEntity(raw, type, level, index, unitScale = 1) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const scaled = (value, fallback, min = -100000, max = 100000) => value == null || value === '' ? fallback : finite(Number(value) * unitScale, fallback, min, max);
    const entity = {
      ...source,
      id: text(source.id, `${type}-${level}-${index}`, 80),
      type,
      level,
      visible: source.visible !== false,
      angle: finite(source.angle ?? source.rotation, 0, -Math.PI * 4, Math.PI * 4)
    };
    if ('x' in source || !('x1' in source)) {
      entity.x = scaled(source.x, 0);
      entity.y = scaled(source.y, 0);
    }
    if ('x1' in source || ['wall', 'stairs', 'path', 'zone'].includes(type)) {
      entity.x1 = scaled(source.x1, 0); entity.y1 = scaled(source.y1, 0);
      entity.x2 = scaled(source.x2, entity.x1 + 100); entity.y2 = scaled(source.y2, entity.y1);
    }
    entity.w = scaled(source.w ?? source.width ?? source.size, type === 'pillar' ? 20 : 60, 1, 5000);
    entity.h = scaled(source.h ?? source.depth ?? source.height ?? source.size, type === 'pillar' ? 20 : 40, 1, 5000);
    entity.height3d = scaled(source.height3d ?? source.machineHeight, type === 'machine' ? 70 : 50, 1, 1000);
    if (source.wallThickness != null) entity.wallThickness = scaled(source.wallThickness, 10, 1, 5000);
    if (source.wallHeight != null) entity.wallHeight = scaled(source.wallHeight, 120, 30, 4000);
    entity.label = text(source.label ?? source.name ?? source.id, entity.id, 120);
    entity.color = /^#[0-9a-f]{6}$/i.test(String(source.color || '')) ? source.color : undefined;
    entity.elevation = scaled(source.elevation,0,0,10000);
    if(source.operationClearance!==undefined)entity.operationClearance=scaled(source.operationClearance,0,0,500);
    if(source.maintenanceClearance!==undefined)entity.maintenanceClearance=scaled(source.maintenanceClearance,0,0,500);
    if (type === 'pillar') entity.size = entity.w;
    if (type === 'shelf') {
      entity.levels = Math.round(finite(source.levels, 3, 1, MAX_SHELF_LEVELS));
      entity.shelfHeight = scaled(source.shelfHeight, 15 + entity.levels * 30, 30, 1000);
      entity.positions = Math.round(finite(source.positions, Math.max(1, Math.floor(entity.w/25)), 1, MAX_SHELF_POSITIONS));
      entity.items = (Array.isArray(source.items) ? source.items : []).slice(0, MAX_ENTITIES_PER_TYPE).map((item, itemIndex) => ({
        id: text(item && item.id, `item-${itemIndex}`, 80), material: text(item && (item.material || item.name), '', 200),
        level: Math.round(finite(item && item.level, 1, 1, entity.levels)), position: Math.round(finite(item && item.position, 1, 1, entity.positions)),
        color: /^#[0-9a-f]{6}$/i.test(String(item && item.color || '')) ? item.color : '#3b82f6'
      }));
    }
    if (type === 'addon') {
      entity.name = text(source.name, entity.label, 120);
      entity.fileExt = ['glb', 'gltf', 'obj', 'stl'].includes(String(source.fileExt || '').toLowerCase()) ? String(source.fileExt).toLowerCase() : '';
      entity.fileUrl = /^blob:[^\s"'<>]{1,2048}$/i.test(String(source.fileUrl || '')) ? source.fileUrl : null;
      entity.width = entity.w; entity.height = entity.h;
    }
    return entity;
  }

  function emptyFloor() {
    return Object.fromEntries(Object.keys(COLLECTIONS).map(key => [key, []]));
  }

  function normalizeBlueprint(input) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const floorsInput = source.floors && typeof source.floors === 'object' ? source.floors : {0: {}};
    const unitScale = source.units === 'm' ? 100 : 1;
    const floors = {};
    Object.keys(floorsInput).slice(0, MAX_FLOORS).forEach(levelKey => {
      const level = Number.parseInt(levelKey, 10);
      if (!Number.isInteger(level) || level < 0 || level >= MAX_FLOORS) return;
      const floorSource = floorsInput[levelKey] && typeof floorsInput[levelKey] === 'object' ? floorsInput[levelKey] : {};
      const floor = emptyFloor();
      Object.entries(COLLECTIONS).forEach(([collection, type]) => {
        const values = Array.isArray(floorSource[collection]) ? floorSource[collection].slice(0, MAX_ENTITIES_PER_TYPE) : [];
        floor[collection] = values.map((value, index) => normalizeEntity(value, type, level, index, unitScale));
      });
      floors[level] = floor;
    });
    if (!floors[0]) floors[0] = emptyFloor();
    return {
      schemaVersion: SCHEMA_VERSION,
      units: 'cm',
      name: text(source.name, '', 120),
      config: source.config && typeof source.config === 'object' ? {...source.config,
        wallHeight: scaledConfig(source.config.wallHeight, 120, unitScale, 60, 4000)} : {},
      floors
    };
  }

  function map2DTo3D(x, y, elevation = 0, scale = 1) {
    return {x: finite(x, 0) * scale, y: finite(elevation, 0) * scale, z: finite(y, 0) * scale};
  }

  function createScenePlan(input, options = {}) {
    const blueprint = normalizeBlueprint(input);
    const scale = finite(options.scale, 1, 0.001, 100);
    const dimensions = sceneDimensions(blueprint);
    const floorHeight = dimensions.floorHeight;
    const entities = [];
    Object.entries(blueprint.floors).forEach(([levelKey, floor]) => {
      const level = Number(levelKey); const elevation = level * floorHeight;
      Object.entries(COLLECTIONS).forEach(([collection, type]) => {
        floor[collection].forEach(entity => {
          if (!entity.visible) return;
          const isRectangle = ['shelf','machine','forklift','dock','addon'].includes(type);
          const position = entity.x1 === undefined
            ? map2DTo3D(entity.x + (isRectangle ? entity.w/2 : 0), entity.y + (isRectangle ? entity.h/2 : 0), elevation + finite(entity.elevation,0,0,10000), scale)
            : map2DTo3D((entity.x1 + entity.x2) / 2, (entity.y1 + entity.y2) / 2, elevation, scale);
          entities.push({id: entity.id, type, level, position, rotationY: -entity.angle,
            width: entity.w * scale, depth: entity.h * scale, height: (type === 'shelf' ? entity.shelfHeight : ['wall','pillar'].includes(type) ? (entity.wallHeight || dimensions.wallHeight) : entity.height3d) * scale,
            length: entity.x1 === undefined ? undefined : Math.hypot(entity.x2-entity.x1, entity.y2-entity.y1) * scale,
            lineAngle: entity.x1 === undefined ? undefined : Math.atan2(entity.y2-entity.y1, entity.x2-entity.x1),
            color: entity.color, label: entity.label, source: entity});
        });
      });
    });
    return {schemaVersion: SCHEMA_VERSION, blueprint, entities, dimensions};
  }

  function sceneDimensions(input) {
    let wallHeight = Math.max(120, Number(input.config?.wallHeight) || 120);
    for (const floor of Object.values(input.floors || {})) {
      for (const shelf of floor.shelves || []) if (shelf.visible !== false) wallHeight = Math.max(wallHeight, (Number(shelf.shelfHeight) || 15 + (shelf.levels || 3) * 30) + 20);
      for (const wall of floor.walls || []) wallHeight = Math.max(wallHeight, Number(wall.wallHeight) || 0);
    }
    return {wallHeight, floorHeight:Math.max(160, wallHeight + 20)};
  }

  function transformEntity(entity, values) {
    const result = {...entity};
    const ranges = {x:[-100000,100000],y:[-100000,100000],width:[1,5000],depth:[1,5000],height:[['machine','forklift'].includes(entity.type)?1:30,['wall','pillar'].includes(entity.type)?4000:1000],rotation:[-720,720]};
    for (const [key,[min,max]] of Object.entries(ranges)) {
      const n=Number(values[key]);
      if(values[key]==='' || !Number.isFinite(n) || n<min || n>max) throw new Error('Dimensões inválidas: '+key);
    }
    result.label = text(values.label, entity.label, 120);
    const angle=Number(values.rotation)*Math.PI/180;
    if(entity.x1 !== undefined) {
      result.x1=Number(values.x);result.y1=Number(values.y);
      if(entity.type==='zone') {result.x2=result.x1+Number(values.width);result.y2=result.y1+Number(values.depth);}
      else {result.x2=result.x1+Math.cos(angle)*Number(values.width);result.y2=result.y1+Math.sin(angle)*Number(values.width);}
    } else {result.x=Number(values.x);result.y=Number(values.y);}
    result.w=Number(values.width);result.h=Number(values.depth);result.angle=angle;
    if(entity.type==='wall')result.wallThickness=Number(values.depth);
    if(entity.type==='shelf')result.shelfHeight=Number(values.height);
    else if(['wall','pillar'].includes(entity.type))result.wallHeight=Number(values.height);
    else result.height3d=Number(values.height);
    if(entity.type==='pillar')result.size=result.w;
    if(entity.type==='addon'){result.width=result.w;result.height=result.h;}
    return result;
  }

  function scaledConfig(value, fallback, unitScale, min, max) {
    if (value == null || value === '') return fallback;
    return finite(Number(value) * unitScale, fallback, min, max);
  }

  return {SCHEMA_VERSION, COLLECTIONS, MAX_FLOORS, MAX_ENTITIES_PER_TYPE, MAX_SHELF_LEVELS, MAX_SHELF_POSITIONS, emptyFloor, normalizeEntity, normalizeBlueprint, map2DTo3D, createScenePlan, sceneDimensions, transformEntity};
});
