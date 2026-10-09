const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const htmlFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/home/index.html';
const content = fs.readFileSync(htmlFile, 'utf8');

const dom = new JSDOM(content, {
  url: "http://localhost/evah/home/index.html",
  runScripts: "dangerously",
  resources: "usable"
});

const window = dom.window;

// Mock localStorage
let store = {
  evah_users: JSON.stringify([{email: 'root@evah.local', role: 'admin'}]),
  evah_orgs: JSON.stringify([{id: 'org_1', name: 'Org 1'}])
};
window.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => store[k] = v,
  removeItem: (k) => delete store[k]
};

// Mock Auth
window.Auth = {
  isAuthenticated: () => true,
  getUser: () => ({ email: 'root@evah.local', name: 'Root', role: 'admin' }),
  logout: () => {}
};

setTimeout(() => {
  try {
    // Manually trigger onload
    window.onload();
    console.log("Onload success");
    
    // Call openAdminModal
    window.openAdminModal();
    console.log("openAdminModal success");
    
  } catch(e) {
    console.error("ERROR CAUGHT:", e);
  }
}, 500);
