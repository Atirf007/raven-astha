const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../../js/node_modules/jsdom');

test('a stalled read times out without clearing the session', async () => {
  const dom = new JSDOM('', { runScripts: 'outside-only', url: 'http://localhost/app/home.html' });
  const { window } = dom;
  try {
    window.localStorage.setItem('astha_token', 'test-session');
    let expire;
    window.setTimeout = (callback, delay) => { assert.equal(delay, 20000); expire = callback; return 1; };
    window.fetch = (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new window.DOMException('Expired', 'AbortError')));
    });
    window.console.error = () => {};
    window.eval(fs.readFileSync(path.resolve(__dirname, '../../app/js/api.js'), 'utf8') + '\nwindow.API = API;');
    const read = window.API.get('/materials');
    expire();
    const result = await read;
    assert.equal(result.success, false);
    assert.match(result.error, /carregamento demorou/);
    assert.equal(window.localStorage.getItem('astha_token'), 'test-session');
    assert.equal(window.API._pendingReads.size, 0);
  } finally { window.close(); }
});
test('simultaneous reads share one fetch, and later reads remain fresh',async()=>{
 const dom=new JSDOM('<meta name="csrf-token" content="">',{runScripts:'outside-only',url:'http://localhost/app/'}),w=dom.window;
 let fetches=0,resolve;
 w.fetch=()=>{fetches++;return new Promise(r=>{resolve=()=>r({ok:true,status:200,json:async()=>({value:fetches})});});};
 w.eval(fs.readFileSync(path.join(__dirname,'../../app/js/api.js'),'utf8')+'\nwindow.api=API;');
 const first=w.api.get('/eam/assets'),second=w.api.get('/eam/assets');assert.equal(first,second);assert.equal(fetches,1);resolve();await Promise.all([first,second]);
 const third=w.api.get('/eam/assets');assert.equal(fetches,2);resolve();await third;dom.window.close();
});
test('rate limit response exposes the actual retry interval and readable Portuguese',async()=>{
 const dom=new JSDOM('',{runScripts:'outside-only',url:'http://localhost/app/'}),w=dom.window;
 w.fetch=async()=>({ok:false,status:429,headers:new w.Headers({'Retry-After':'17'}),json:async()=>({error:'legacy'})});
 w.eval(fs.readFileSync(path.join(__dirname,'../../app/js/api.js'),'utf8')+'\nwindow.api=API;');
 const result=await w.api.get('/eam/reliability/summary');assert.equal(result.retryAfter,17);assert.match(result.error,/17 segundos/);dom.window.close();
});

test('authenticated CSV download reads text while errors retain JSON handling',async()=>{
 const dom=new JSDOM('',{runScripts:'outside-only',url:'https://astha.test/app/'}),w=dom.window;w.localStorage.setItem('astha_token','session');let fail=false;
 w.fetch=async(_url,config)=>{assert.equal(config.headers.Authorization,'Bearer session');return fail?{ok:false,status:403,json:async()=>({error:'Não autorizado'})}:{ok:true,status:200,text:async()=>'subject_id,value\r\na,20'};};
 w.console.error=()=>{};w.eval(fs.readFileSync(path.join(__dirname,'../../app/js/api.js'),'utf8')+'\nwindow.api=API;');
 const response=await w.api.request('/analytics/jobs/example/csv',{method:'GET',responseType:'text'});assert.equal(response.data.content,'subject_id,value\r\na,20');fail=true;assert.equal((await w.api.request('/analytics/jobs/example/csv',{method:'GET',responseType:'text'})).error,'Não autorizado');w.close();
});

test('concurrent expired requests show one notice and preserve the current page', async () => {
  const dom = new JSDOM('<meta name="csrf-token" content="">', {
    runScripts: 'outside-only',
    url: 'http://127.0.0.1:3001/app/sistema.html?tab=eam',
  });
  const { window } = dom;
  let notices = 0;
  let redirects = 0;
  window.localStorage.setItem('astha_token', 'expired-test-token');
  window.showToast = () => { notices += 1; };
  window.setTimeout = (_callback, delay) => { if (delay === 1200) redirects += 1; return delay; };
  window.fetch = async () => ({ status: 401, json: async () => ({ error: 'Sessão expirada' }) });
  window.eval(fs.readFileSync(path.resolve(__dirname, '../../app/js/api.js'), 'utf8') + '\nwindow.API = API;');

  const results = await Promise.all(['/eam/assets', '/eam/orders', '/eam/spares'].map(endpoint => window.API.get(endpoint)));
  assert.ok(results.every(result => result.success === false));
  assert.equal(notices, 1);
  assert.equal(redirects, 1);
  assert.equal(window.localStorage.getItem('astha_token'), null);
  assert.equal(window.sessionStorage.getItem('ASTHA_redirect'), '/app/sistema.html?tab=eam');
  dom.window.close();
});

test('invalid login stays on the login form with its server error', async () => {
  const dom = new JSDOM('', { runScripts: 'outside-only', url: 'http://127.0.0.1:3001/app/login.html' });
  const { window } = dom;
  let redirects = 0;
  window.showToast = () => { redirects += 1; };
  window.setTimeout = () => { redirects += 1; return redirects; };
  window.fetch = async () => ({ status: 401, ok: false, json: async () => ({ error: 'Credenciais inválidas' }) });
  window.eval(fs.readFileSync(path.resolve(__dirname, '../../app/js/api.js'), 'utf8') + '\nwindow.API = API;');

  const result = await window.API.post('/auth/login', { email: 'wrong@example.test', password: 'wrong' });
  assert.equal(result.success, false);
  assert.equal(result.error, 'Credenciais inválidas');
  assert.equal(redirects, 0);
  dom.window.close();
});
