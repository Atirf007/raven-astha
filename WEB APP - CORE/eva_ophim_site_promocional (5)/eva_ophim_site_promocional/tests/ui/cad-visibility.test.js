'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('CAD hidden-to-visible resize preserves finite projection and updates the renderer without maximizing', () => {
  const sizes = [], panel = {clientWidth:0,clientHeight:0};
  const projection = {aspect:1,updates:0,updateProjectionMatrix(){this.updates++;}};
  const context = vm.createContext({window:{},requestAnimationFrame:()=>1,panel,projection,sizes});
  vm.runInContext(fs.readFileSync('app/js/sistema-builder-3d.js','utf8'),context);
  vm.runInContext('container3D=panel; camera=projection; renderer={setSize:(w,h)=>sizes.push([w,h])};',context);
  context.window.resizeCad3D();
  assert.equal(sizes.length,0);
  panel.clientWidth=640; panel.clientHeight=480;
  context.window.resizeCad3D();
  assert.equal(projection.aspect,640/480);
  assert.equal(sizes.length,1);
  assert.equal(sizes[0][0],640);
  assert.equal(sizes[0][1],480);
  panel.clientHeight=0;
  context.window.resizeCad3D();
  assert.equal(sizes.length,1);
  assert.ok(Number.isFinite(projection.aspect));
  panel.clientWidth=1280; panel.clientHeight=480;
  context.window.resizeCad3D();
  assert.equal(sizes.at(-1)[0],1280);
  assert.equal(sizes.at(-1)[1],480);
});
