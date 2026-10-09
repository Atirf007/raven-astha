const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../../js/node_modules/jsdom');
const root = path.resolve(__dirname, '../..');
const settle = () => new Promise(resolve => setImmediate(resolve));
async function setup() {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'app/settings.html'), 'utf8'), { runScripts: 'outside-only', url: 'http://localhost/app/settings.html' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  w.showToast = () => {};
  const user = { id: 1, name: 'Administrador', role: 'superadmin', is_active: 1, avatar_url: 'data:image/png;base64,AAAA', org_name: 'Empresa', org_plan: 'enterprise', org_logo: 'data:image/png;base64,AAAA' };
  const values = {
    '/auth/me': user, '/org/me': { name: 'Empresa', plan: 'enterprise', logo_url: user.org_logo, email: 'empresa@example.com' },
    '/org/users': [{ ...user, avatar_url: undefined }, { id: 2, name: 'Colaborador', role: 'viewer', is_active: 1 }], '/org/units': [], '/org/groups': { groups: [], members: [] }, '/org/positions': [], '/org/chart': [], '/org/invites': [], '/eam/functional-locations': [], '/org/profile-design': { cover_image: null, links: [{label:'Slack',url:'https://example.com/slack'}] }
  };
  const writes = [];
  w.API = {
    get: async endpoint => ({ success: true, data: values[endpoint] }),
    put: async (endpoint, payload) => { writes.push({ endpoint, payload }); return { success: true, data: { id: 7 } }; },
    post: async (endpoint, payload) => { writes.push({ endpoint, payload }); return { success: true, data: { id: 7 } }; }
  };
  w.eval(['profile-avatar.js', 'app-shell.js', 'settings-dialogs.js', 'settings-profile-design.js', 'settings-org.js', 'settings-workspace.js'].map(file => fs.readFileSync(path.join(root, 'app/js', file), 'utf8')).join('\n'));
  await settle(); await settle();
  return { dom, w, writes };
}
test('corporate editors are separate dialogs; categories expose only their selected section', async () => {
  const { dom, w } = await setup();
  try {
    const d = w.document;
    assert.equal(d.querySelectorAll('dialog.corporate-dialog').length, 7);
    assert.equal(d.querySelector('#hasWorkspace form'), null);
    assert.equal(d.querySelector('#orgUnitsCard form'), null);
    assert.equal(d.querySelector('#corporateCompanySummary dd').textContent, 'Empresa');
    d.querySelector('#corporateEditCompany').click();
    assert.equal(d.querySelector('#workspaceForm').closest('dialog').open, true);
    d.querySelector('#workspaceForm').closest('dialog').querySelector('button').click();
    assert.equal(d.querySelector('#workspaceForm').closest('dialog').open, false);
    d.querySelector('.corporate-categories button:nth-child(2)').click();
    assert.equal(d.querySelector('#workspaceGroupsCard').classList.contains('corporate-category-hidden'), false);
    assert.equal(d.querySelector('#workspaceMembersCard').classList.contains('corporate-category-hidden'), true);
    assert.ok(d.querySelector('.workspace-member-avatar img'));
    assert.ok(d.querySelector('[data-app-brand] img:not([hidden])'));
  } finally { dom.window.close(); }
});
test('unit save closes on success, preserves the dialog on error and submits its category', async () => {
  const { dom, w, writes } = await setup();
  try {
    const d = w.document, selector = d.querySelector('#orgCategorySelect');
    selector.value = 'cost_center'; selector.dispatchEvent(new w.Event('change'));
    d.querySelector('#orgNewUnit').click();
    const form = d.querySelector('#orgUnitForm'), dialog = form.closest('dialog');
    assert.equal(dialog.open, true);
    form.elements.code.value = 'CC-01'; form.elements.name.value = 'Operação';
    const originalPost = w.API.post;
    w.API.post = async () => ({ success: false, error: 'Erro de teste' });
    form.dispatchEvent(new w.Event('submit', { cancelable: true })); await settle();
    assert.equal(dialog.open, true); assert.equal(d.querySelector('#orgUnitStatus').textContent, 'Erro de teste');
    w.API.post = originalPost;
    form.dispatchEvent(new w.Event('submit', { cancelable: true })); await settle();
    assert.equal(dialog.open, false);
    assert.equal(writes[0].payload.unit_type, 'cost_center');
  } finally { dom.window.close(); }
});
test('member assignment opens separately and keeps access changes connected to the selected person', async () => {
  const { dom, w, writes } = await setup();
  try {
    const d = w.document;
    assert.equal(d.querySelector('#workspaceMembers select'), null);
    d.querySelector('#workspaceMembers button').click();
    const editor = d.querySelector('#corporateMemberAccess');
    assert.equal(editor.closest('dialog').open, true);
    editor.querySelector('.workspace-member-role').value = 'operator';
    editor.querySelector('button').click(); await settle();
    assert.ok(writes.some(item => item.endpoint === '/org/users/2' && item.payload.role === 'operator'));
    assert.equal(editor.closest('dialog').open, false);
  } finally { dom.window.close(); }
});
test('corporate links render safely and invalid destinations cannot be saved', async () => {
  const {dom,w,writes}=await setup();
  try {
    const d=w.document;
    assert.equal(d.querySelector('.corporate-links a').href,'https://example.com/slack');
    assert.equal(d.querySelector('.corporate-links a').rel,'noopener noreferrer');
    const form=d.querySelector('#corporateDesignForm');
    form.querySelector('[data-link-url]').value='javascript:alert(1)';
    form.dispatchEvent(new w.Event('submit',{cancelable:true})); await settle();
    assert.equal(writes.length,0);
    form.querySelector('[data-link-url]').value='https://example.com/sharepoint';
    form.dispatchEvent(new w.Event('submit',{cancelable:true})); await settle();
    assert.ok(writes.some(item=>item.endpoint==='/org/profile-design' && item.payload.links[0].url==='https://example.com/sharepoint'));
  } finally {dom.window.close();}
});
test('group assignment failure retains its saved id so retry updates instead of duplicating', async () => {
  const { dom, w, writes } = await setup();
  try {
    const d = w.document;
    d.querySelector('#orgNewGroup').click();
    const form = d.querySelector('#orgGroupForm');
    form.elements.code.value = 'GR-01'; form.elements.name.value = 'Operadores';
    const originalPut = w.API.put;
    w.API.put = async (endpoint, payload) => endpoint.endsWith('/members') ? { success: false, error: 'Erro de teste' } : originalPut(endpoint, payload);
    form.dispatchEvent(new w.Event('submit', { cancelable: true })); await settle();
    assert.equal(form.elements.id.value, '7'); assert.equal(form.closest('dialog').open, true);
    w.API.put = originalPut;
    form.dispatchEvent(new w.Event('submit', { cancelable: true })); await settle();
    assert.equal(writes.filter(item => item.endpoint === '/org/groups').length, 1);
    assert.ok(writes.some(item => item.endpoint === '/org/groups/7'));
    assert.equal(form.closest('dialog').open, false);
  } finally { dom.window.close(); }
});
