const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseDxf } = require('../../app/js/eam-dxf-viewer.js');

test('DXF preview accepts finite 2D geometry and identifies unsupported entities', () => {
  const drawing = ['0','SECTION','2','ENTITIES','0','LINE','10','0','20','0','11','25','21','10','0','CIRCLE','10','2','20','3','40','4','0','LWPOLYLINE','70','1','10','0','20','0','10','5','20','0','10','5','20','5','0','HATCH','0','ENDSEC','0','EOF'].join('\n');
  const parsed = parseDxf(drawing);
  assert.deepEqual(parsed.entities.map(entity => entity.type), ['LINE', 'CIRCLE', 'LWPOLYLINE']);
  assert.equal(parsed.entities[2].closed, true);
  assert.equal(parsed.ignored, 1);
  const invalidCoordinate = parseDxf(drawing.replace('25', 'Infinity'));
  assert.equal(invalidCoordinate.entities.length, 2);
  assert.equal(invalidCoordinate.ignored, 2);
});

test('DXF preview rejects unsupported and oversized drawings', () => {
  assert.throws(() => parseDxf('0\nSECTION\n2\nENTITIES\n0\nHATCH\n0\nENDSEC\n0\nEOF'), /sem entidades/);
  assert.throws(() => parseDxf('x'.repeat(8 * 1024 * 1024 + 1)), /limite/);
});
