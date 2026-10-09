const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({
  URL,
  window: { location: { href: 'http://127.0.0.1:4173/app/home.html', origin: 'http://127.0.0.1:4173', hostname: '127.0.0.1' } },
  document: { createElement: () => ({ style: {} }) }
});
vm.runInContext(fs.readFileSync('app/js/profile-avatar.js', 'utf8'), context);
const avatar = vm.runInContext('ProfileAvatar', context);

function element() {
  return {
    textContent: '',
    children: [],
    replaceChildren(...children) { this.children = children; this.textContent = ''; }
  };
}

test('profile response selects the user rather than the API wrapper', () => {
  const user = { id: 7, name: 'Admin Supremo', avatar_url: 'data:image/png;base64,aGVsbG8=' };
  assert.equal(avatar.fromResponse({ success: true, data: user }), user);
  assert.equal(avatar.fromResponse({ success: false, data: user }), null);
});

test('profile photo appears in each avatar and falls back if the image fails', () => {
  const user = { name: 'Admin Supremo', avatar_url: 'data:image/png;base64,aGVsbG8=' };
  for (const target of [element(), element(), element()]) {
    avatar.render(target, user);
    assert.equal(target.children.length, 1);
    assert.equal(target.children[0].src, user.avatar_url);
    target.children[0].onerror();
    assert.equal(target.textContent, 'A');
    assert.equal(target.children.length, 0);
  }
});

test('invalid image URL stays as an initial; local API image remains available', () => {
  const target = element();
  avatar.render(target, { name: 'Admin', avatar_url: 'javascript:alert(1)' });
  assert.equal(target.textContent, 'A');
  assert.equal(target.children.length, 0);
  avatar.render(target, { name: 'Admin', avatar_url: 'http://127.0.0.1:3000/uploads/avatar.png' });
  assert.equal(target.children[0].src, 'http://127.0.0.1:3000/uploads/avatar.png');
});
