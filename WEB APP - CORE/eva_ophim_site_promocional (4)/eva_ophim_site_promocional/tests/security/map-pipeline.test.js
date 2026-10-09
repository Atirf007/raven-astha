const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const MapModel = require('../../app/js/sistema-map-model');
const {validateBlueprint, MAX_BLUEPRINT_BYTES} = require('../../api/security/blueprint');

function fixture() {
  return {floors:{0:{
    walls:[{id:'W1',x1:0,y1:0,x2:100,y2:0}], doors:[{id:'D1',x:20,y:0}],
    windows:[{id:'WIN1',x:60,y:0}], pillars:[{id:'C1',x:40,y:40,size:20}],
    shelves:[{id:'S1',x:100,y:200,w:100,h:40,levels:3}], stairs:[{id:'ST1',x1:0,y1:80,x2:80,y2:80}],
    zones:[{id:'Z1',x1:0,y1:100,x2:120,y2:180}], paths:[{id:'R1',x1:0,y1:220,x2:180,y2:220}],
    machines:[{id:'M1',x:200,y:100,w:80,h:50,height3d:70}],
    forklifts:[{id:'F1',x:300,y:100,w:36,h:24}], docks:[{id:'DO1',x:0,y:260,w:100,h:45}]
  },1:{walls:[{id:'W2',x1:10,y1:10,x2:10,y2:110}]}}};
}

test('MAP-001 legacy blueprint normalizes and survives JSON save/load', () => {
  const normalized=MapModel.normalizeBlueprint(fixture());
  assert.equal(normalized.schemaVersion,2); assert.equal(normalized.units,'cm');
  const reloaded=MapModel.normalizeBlueprint(JSON.parse(JSON.stringify(normalized)));
  for(const key of Object.keys(MapModel.COLLECTIONS)) assert.deepEqual(reloaded.floors[0][key],normalized.floors[0][key]);
});

test('MAP-002 every supported visible blueprint entity reaches the canonical 3D plan', () => {
  const plan=MapModel.createScenePlan(fixture());
  assert.deepEqual(new Set(plan.entities.map(e=>e.type)),new Set(['wall','door','window','pillar','shelf','stairs','zone','path','machine','forklift','dock']));
  for(const id of ['W1','D1','WIN1','C1','S1','ST1','Z1','R1','M1','F1','DO1','W2']) assert.ok(plan.entities.some(e=>e.id===id),id);
});

test('MAP-003 coordinates, rotation and levels share one transform', () => {
  const input={floors:{1:{machines:[{id:'M',x:100,y:200,w:20,h:40,angle:Math.PI/2}]}}};
  const entity=MapModel.createScenePlan(input,{scale:.1,floorHeight:160}).entities[0];
  assert.deepEqual(entity.position,{x:11,y:16,z:22}); assert.equal(entity.rotationY,-Math.PI/2); assert.equal(entity.level,1);
});

test('MAP-003 meter blueprints normalize to canonical centimeters', () => {
  const normalized=MapModel.normalizeBlueprint({units:'m',floors:{0:{machines:[{x:1,y:2,w:.5,h:.25,height3d:.8}]}}});
  const machine=normalized.floors[0].machines[0];
  assert.equal(normalized.units,'cm'); assert.deepEqual([machine.x,machine.y,machine.w,machine.h,machine.height3d],[100,200,50,25,80]);
});

test('MAP-004 invisible and unknown entities do not crash or enter the plan', () => {
  const input=fixture(); input.floors[0].machines[0].visible=false; input.floors[0].unknown=[{id:'BAD',type:'constructor'}];
  const plan=MapModel.createScenePlan(input); assert.ok(!plan.entities.some(e=>e.id==='M1'||e.id==='BAD'));
});

test('MAP-SEC-002 persisted addons cannot trigger external model fetches', () => {
  const input={floors:{0:{addons:[{id:'A',fileUrl:'https://example.invalid/tracker.glb',fileExt:'glb'},{id:'B',fileUrl:'blob:http://localhost/1234-abcd',fileExt:'OBJ'}]}}};
  const addons=MapModel.normalizeBlueprint(input).floors[0].addons;
  assert.equal(addons[0].fileUrl,null); assert.equal(addons[1].fileUrl,'blob:http://localhost/1234-abcd'); assert.equal(addons[1].fileExt,'obj');
});

test('MAP-005 API validation enforces size, entity limits and finite dimensions', () => {
  assert.equal(validateBlueprint(fixture()).schemaVersion,2);
  assert.equal(validateBlueprint({floors:{0:{addons:[{fileUrl:'blob:http://localhost/id',fileExt:'glb'}]}}}).floors[0].addons[0].fileUrl,null);
  const excessive={floors:{0:{walls:Array.from({length:MapModel.MAX_ENTITIES_PER_TYPE+1},()=>({x1:0,y1:0,x2:1,y2:1}))}}};
  assert.throws(()=>validateBlueprint(excessive),/entidades demais/);
  assert.throws(()=>validateBlueprint({floors:{0:{shelves:[{levels:1e9,positions:1e9,items:[]}]}}}),/Prateleira excede/);
  assert.throws(()=>validateBlueprint({floors:{0:{shelves:[{items:Array(MapModel.MAX_ENTITIES_PER_TYPE+1).fill({})}]}}}),/itens demais/);
  assert.throws(()=>validateBlueprint({floors:{0:{shelves:[1]}}}),/Entidade inválida/);
  const excessiveTotal={floors:Object.fromEntries(Array.from({length:6},(_,level)=>[level,{walls:Array.from({length:2000},()=>({x1:0,y1:0,x2:1,y2:1}))}]))};
  assert.throws(()=>validateBlueprint(excessiveTotal),/orçamento de renderização/);
  assert.throws(()=>validateBlueprint({payload:'x'.repeat(MAX_BLUEPRINT_BYTES)}),/limite/);
});

test('MAP-006 both web viewers consume the canonical model and render on demand', () => {
  const html=fs.readFileSync(path.join(root,'app/sistema.html'),'utf8');
  const cad3d=fs.readFileSync(path.join(root,'app/js/sistema-builder-3d.js'),'utf8');
  assert.match(html,/ASTHAMapModel\.createScenePlan/); assert.match(cad3d,/ASTHAMapModel\.normalizeBlueprint/);
  assert.doesNotMatch(html,/function animate\(\) \{\s*af = requestAnimationFrame\(animate\)/);
  assert.doesNotMatch(cad3d,/function animate\(\) \{\s*requestAnimationFrame\(animate\)/);
  assert.match(cad3d,/value\.filter\(entity => entity\.visible !== false\)/);
  assert.match(cad3d,/Object\.keys\(material\).*isTexture/);
  assert.match(cad3d,/rackGroup\.position\.set\(sh\.x\+sh\.w\/2, floorY, sh\.y\+sh\.h\/2\)/);
});

test('MAP-007 addon hit testing and rendering stay in their correct pipeline stages', () => {
  const source=fs.readFileSync(path.join(root,'app/js/sistema-builder-2d.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'app/sistema.html'),'utf8');
  const hovered=source.slice(source.indexOf('function getHoveredItem'),source.indexOf('function applyDrag'));
  const render=source.slice(source.indexOf('function renderCad'),source.indexOf('window.saveBlueprint'));
  assert.match(hovered,/type: 'addon'/); assert.doesNotMatch(hovered,/ctx\./);
  assert.match(render,/fillText\('3D'/); assert.doesNotMatch(render,/if \(x >= a\.x/);
  assert.match(render,/translate\(item\.x\+w\/2, item\.y\+h\/2\)/);
  assert.match(render,/translate\(sh\.x\+sh\.w\/2,sh\.y\+sh\.h\/2\)/);
  assert.match(html,/shelfYaw = -\(sh\.angle \|\| 0\)/);
  assert.match(source,/if \(w\.visible === false\) return/); assert.match(source,/if \(sh\.visible === false\) continue/);
});
