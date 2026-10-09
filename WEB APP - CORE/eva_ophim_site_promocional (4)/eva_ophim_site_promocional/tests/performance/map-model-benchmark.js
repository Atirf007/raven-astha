const { performance } = require('node:perf_hooks');
const { createScenePlan } = require('../../app/js/sistema-map-model');

function blueprint(entityCount) {
  const floor = { walls: [], doors: [], windows: [], pillars: [], shelves: [], stairs: [], zones: [], paths: [], machines: [], forklifts: [], docks: [], addons: [] };
  const types = Object.keys(floor);
  for (let i = 0; i < entityCount; i += 1) {
    const collection = types[i % types.length];
    floor[collection].push({ id: `${collection}-${i}`, x: (i % 50) * 20, y: Math.floor(i / 50) * 20, w: 16, h: 12, x1: i, y1: i, x2: i + 10, y2: i + 5 });
  }
  return { schemaVersion: 2, units: 'cm', floors: { 0: floor } };
}

function measure(entityCount, rounds = 30) {
  const input = blueprint(entityCount);
  const samples = [];
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    const result = createScenePlan(input, { scale: 0.06, floorHeight: 160 });
    if (result.entities.length !== entityCount) throw new Error('Contagem de entidades divergente');
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return { entities: entityCount, rounds, medianMs: Number(samples[Math.floor(samples.length / 2)].toFixed(3)), maxMs: Number(samples.at(-1).toFixed(3)) };
}

console.log(JSON.stringify({ benchmark: 'canonical-map-model', results: [measure(25), measure(250), measure(1200)] }, null, 2));
