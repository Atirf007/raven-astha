const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfile } = require('../../api/security/organization-profile');
test('corporate profile accepts ordinary links and raster cover signatures', () => {
  const cover_image = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
  assert.equal(validateProfile({cover_image,links:[{label:' Slack ',url:'https://example.com/slack'}]}).links[0].label,'Slack');
});
test('corporate profile rejects active URLs, credentials, fake raster images and oversized lists', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com/', 'file:///test']) {
    assert.throws(() => validateProfile({cover_image:null,links:[{label:'Link',url}]}));
  }
  assert.throws(() => validateProfile({cover_image:'data:image/png;base64,AAAA',links:[]}));
  assert.throws(() => validateProfile({cover_image:null,links:Array(13).fill({label:'Link',url:'https://example.com'})}));
});
