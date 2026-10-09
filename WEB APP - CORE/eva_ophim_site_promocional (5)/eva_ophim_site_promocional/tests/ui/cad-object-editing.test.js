const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../../app/js/sistema-map-model');
const {validateBlueprint}=require('../../api/security/blueprint');
test('Tall racks and walls share dimensions and floor elevation in both scales',()=>{
 const bp={floors:{0:{shelves:[{id:'S',levels:8,shelfHeight:300}],walls:[{id:'W',x1:0,y1:0,x2:200,y2:0}]},1:{machines:[{id:'M'}]}}};
 const editor=M.createScenePlan(bp),viewer=M.createScenePlan(bp,{scale:.06});
 assert.equal(editor.dimensions.wallHeight,320);assert.equal(editor.dimensions.floorHeight,340);
 for(const e of editor.entities){const v=viewer.entities.find(v=>v.id===e.id);assert.equal(v.height,e.height*.06);assert.equal(v.position.y,e.position.y*.06);}
 assert.equal(viewer.entities.find(e=>e.id==='W').height,19.2);
});
test('Object edits survive validation/save/reload without changing shelf identity or stock',()=>{
 const shelf=M.normalizeBlueprint({floors:{0:{shelves:[{id:'A',warehouse_id:4,levels:3,positions:4}]}}}).floors[0].shelves[0];
 const edited=M.transformEntity(shelf,{x:500,y:200,width:150,depth:50,height:180,rotation:90,label:'Rack novo'});
 const loaded=validateBlueprint(JSON.parse(JSON.stringify({floors:{0:{shelves:[edited]}}}))).floors[0].shelves[0];
 assert.equal(loaded.id,'A');assert.equal(loaded.warehouse_id,4);assert.equal(loaded.positions,4);assert.equal(loaded.shelfHeight,180);assert.equal(loaded.x,500);assert.equal(loaded.angle,Math.PI/2);
});
test('Rotating and resizing a wall updates endpoints, thickness and height',()=>{
 const wall=M.normalizeBlueprint({floors:{0:{walls:[{id:'W',x1:0,y1:0,x2:100,y2:0}]}}}).floors[0].walls[0];
 const w=M.transformEntity(wall,{x:20,y:30,width:200,depth:12,height:250,rotation:90,label:'Parede'});
 assert.ok(Math.abs(w.x2-20)<1e-8);assert.equal(w.y2,230);assert.equal(w.wallHeight,250);assert.equal(w.wallThickness,12);
 assert.throws(()=>M.transformEntity(w,{x:NaN,y:0,width:200,depth:12,height:250,rotation:0}),/inválidas/);
 assert.throws(()=>M.transformEntity(w,{x:0,y:0,width:-1,depth:12,height:250,rotation:0}),/inválidas/);
});
