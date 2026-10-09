const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const createImporter = require('occt-import-js');

const root = path.resolve(__dirname, '../..');

test('pinned CAD engine triangulates controlled STEP and IGES fixtures', async () => {
  const engine = await createImporter();
  for (const [name, method] of [
    ['simple-basic-cube/cube.stp', 'ReadStepFile'],
    ['cube-10x10mm/Cube 10x10.igs', 'ReadIgesFile']
  ]) {
    const bytes = new Uint8Array(fs.readFileSync(path.join(root, 'node_modules/occt-import-js/test/testfiles', name)));
    const result = engine[method](bytes, null);
    assert.equal(result.success, true, name);
    assert(result.meshes.length > 0, name);
    assert(result.meshes[0].attributes.position.array.length >= 9, name);
  }
});

test('browser assets and backend support CAD in the visual and assembly flows', () => {
  const html = fs.readFileSync(path.join(root, 'app/sistema.html'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'app/js/eam-cad-worker.js'), 'utf8');
  const workspace = fs.readFileSync(path.join(root, 'app/js/eam-visual-workspace.js'), 'utf8');
  const routes = fs.readFileSync(path.join(root, 'api/routes/eam.js'), 'utf8');
  assert.match(html, /eam-cad-import\.js/);
  assert.match(worker, /ReadStepFile/);
  assert.match(worker, /ReadIgesFile/);
  assert.match(workspace, /EamCadImport\.parse/);
  assert.match(routes, /glb\|step\|stp\|iges\|igs/);
  assert(fs.statSync(path.join(root, 'app/vendor/occt-import-js/occt-import-js.wasm')).size > 1000000);
});
