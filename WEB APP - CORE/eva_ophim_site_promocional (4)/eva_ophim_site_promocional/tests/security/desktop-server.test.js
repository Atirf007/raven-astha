const { test } = require('node:test');
const assert = require('node:assert/strict');
const { desktopServer } = require('../../desktop-server');
test('central deployment accepts HTTPS origin only, preserving local compatibility',()=>{
  assert.deepEqual(desktopServer(),{url:'http://localhost:3000',local:true});
  assert.deepEqual(desktopServer('https://astha.example.invalid/'),{url:'https://astha.example.invalid',local:false});
  for(const url of ['http://astha.example.invalid','file:///private','https://user:secret@host.invalid','https://host.invalid/api','https://host.invalid/?token=x','https://host.invalid/#fragment'])assert.throws(()=>desktopServer(url));
});
test('desktop deployment validator is included in the installer file list',()=>{
  const manifest=require('../../package.json');assert(manifest.build.files.includes('desktop-server.js'));
});
