const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const rules=require('../../app/js/sistema-industrial-rules');
const source='//'+fs.readFileSync('app/js/sistema-builder-2d.js','utf8').split('// CAD viewport framing:')[1].split('// ?')[0];
test('initial floor framing includes rotated and distant equipment at desktop and mobile widths',()=>{
 const floor={machines:[{x:6000,y:-500,w:240,h:100,angle:Math.PI/4},{x:-1000,y:1500,w:300,h:200}],shelves:[]};
 const canvas={width:320,height:280,parentElement:{clientWidth:320,clientHeight:280},getBoundingClientRect(){return {width:this.parentElement.clientWidth,height:this.parentElement.clientHeight};}};
 const c={cadCanvas:canvas,blueprint:{floors:{0:floor}},currentFloor:0,zoom:1,panX:0,panY:0,cadAutoFrame:true,renderCad(){},ASTHAIndustrialRules:rules};c.window=c;vm.createContext(c);vm.runInContext(source,c);
 for(const width of [320,900]){canvas.parentElement.clientWidth=width;c.resizeCadCanvas();for(const item of floor.machines)for(const p of rules.shape(item)){const x=p.x*c.zoom+c.panX,y=p.y*c.zoom+c.panY;assert.ok(x>=39&&x<=width-39);assert.ok(y>=39&&y<=canvas.height-39);}}
 c.cadAutoFrame=false;const center=(canvas.width/2-c.panX)/c.zoom;canvas.parentElement.clientWidth=450;c.resizeCadCanvas();assert.ok(Math.abs((canvas.width/2-c.panX)/c.zoom-center)<1e-8);
});
