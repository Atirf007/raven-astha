const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/js/sistema-builder-2d.js','utf8').split('// Internal CAD clipboard:')[1];
let history=0,renders=0;
const context={blueprint:{floors:{0:{machines:[{id:'M1',machineType:'LATHE',x:10,y:20,w:100,h:60}],shelves:[{id:'SH-1',x:0,y:0,items:[{id:'material'}]}]},1:{shelves:[{id:'SH-2'}]}}},selectedItem:{type:'machine',index:0},currentFloor:0,currentWarehouseId:6,document:{querySelectorAll:()=>[]},getArrayName:type=>type==='shelf'?'shelves':'machines',saveHistory(){history++},renderCad(){renders++},update3DScene(){},crypto:require('node:crypto').webcrypto};context.window=context;vm.createContext(context);vm.runInContext('//'+source,context);
(async()=>{
assert.equal(context.copyCadItem(),true);assert.equal(await context.pasteCadItem(),true);const first=context.blueprint.floors[0].machines[1];assert.equal(first.machineType,'LATHE');assert.equal(first.x,40);assert.notEqual(first.id,'M1');first.w=300;assert.equal(context.blueprint.floors[0].machines[0].w,100);assert.equal(await context.pasteCadItem(),true);assert.equal(context.blueprint.floors[0].machines[2].x,70);
context.selectedItem={type:'shelf',index:0};context.copyCadItem();context.askCopiedShelfName=async(suggested,duplicate)=>{assert.equal(duplicate('sh-2'),true);return 'SH-3'};assert.equal(await context.pasteCadItem(),true);const shelf=context.blueprint.floors[0].shelves[1];assert.equal(shelf.id,'SH-3');assert.equal(shelf.items.length,0);assert.equal(context.blueprint.floors[0].shelves[0].items.length,1);
context.askCopiedShelfName=async()=>null;const before=history;assert.equal(await context.pasteCadItem(),false);assert.equal(history,before);context.askCopiedShelfName=async()=> 'SH-1';assert.equal(await context.pasteCadItem(),false);assert.equal(history,before);assert.equal(renders,3);
console.log('Cópias independentes, deslocamento, tipo de máquina, prateleira vazia, códigos únicos e cancelamento verificados.');
})().catch(e=>{console.error(e);process.exitCode=1});

