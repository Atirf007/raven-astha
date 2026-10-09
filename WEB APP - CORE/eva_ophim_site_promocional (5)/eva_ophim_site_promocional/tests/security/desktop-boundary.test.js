const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {EventEmitter}=require('node:events');
test('desktop denies privilege requests and foreign navigation while preserving HTTPS links',()=>{
 const events={},child=new EventEmitter(),opened=[];let window;
 const app={requestSingleInstanceLock:()=>true,on:(name,handler)=>{events[name]=handler;},quit(){}};
 class BrowserWindow {
  constructor(options){window=this;this.options=options;this.events={};this.webContents={
   session:{setPermissionRequestHandler:handler=>{this.permissions=handler;},setPermissionCheckHandler:handler=>{this.checkPermission=handler;}},
   setWindowOpenHandler:handler=>{this.open=handler;},on:(name,handler)=>{this.events[name]=handler;}
  };}
  setMenuBarVisibility(){} loadURL(url){this.url=url;} on(){}
 }
 const root=path.resolve(__dirname,'../..');
 vm.runInNewContext(fs.readFileSync(path.join(root,'main.js'),'utf8'),{
  require:name=>name==='electron'?{app,BrowserWindow,dialog:{showErrorBox(){}},shell:{openExternal:url=>opened.push(url)}}:name==='child_process'?{fork:()=>child}:name==='./desktop-server'?require('../../desktop-server'):require(name),
  __dirname:root,process:{env:{},platform:'win32'},URL
 });
 events.ready();child.emit('message',{type:'astha-api-ready'});
 assert.equal(window.options.webPreferences.nodeIntegration,false);
 assert.equal(window.options.webPreferences.contextIsolation,true);
 assert.equal(window.options.webPreferences.sandbox,true);
 let allowed;window.permissions(null,'media',value=>{allowed=value;});assert.equal(allowed,false);
 assert.equal(window.checkPermission(),false);
 for(const url of ['file:///C:/private','javascript:alert(1)','https://evil.example.invalid']){
  let prevented=false;window.events['will-navigate']({preventDefault(){prevented=true;}},url);assert.equal(prevented,true);
 }
 let prevented=false;window.events['will-navigate']({preventDefault(){prevented=true;}},'http://localhost:3000/app/settings.html');assert.equal(prevented,false);
 for(const url of ['javascript:alert(1)','file:///private','https://user:password@example.invalid']) assert.equal(window.open({url}).action,'deny');
 assert.equal(opened.length,0);
 assert.equal(window.open({url:'https://example.invalid/corporate'}).action,'deny');
 assert.deepEqual(opened,['https://example.invalid/corporate']);
});
test('central HTTPS deployment opens its own origin without starting the local API',()=>{
 const events={},opened=[];let window,forks=0;
 const app={requestSingleInstanceLock:()=>true,on:(name,fn)=>{events[name]=fn;},quit(){}};
 class BrowserWindow {
  constructor(){window=this;this.events={};this.webContents={session:{setPermissionRequestHandler(){},setPermissionCheckHandler(){}},setWindowOpenHandler(){},on:(name,fn)=>{this.events[name]=fn;}};}
  setMenuBarVisibility(){} loadURL(url){this.url=url;} on(){}
 }
 const root=path.resolve(__dirname,'../..');
 vm.runInNewContext(fs.readFileSync(path.join(root,'main.js'),'utf8'),{
  require:name=>name==='electron'?{app,BrowserWindow,dialog:{showErrorBox(){}},shell:{openExternal:url=>opened.push(url)}}:name==='child_process'?{fork:()=>{forks++;throw Error('Unexpected local API');}}:name==='./desktop-server'?require('../../desktop-server'):require(name),
  __dirname:root,process:{env:{ASTHA_SERVER_URL:'https://astha.example.invalid'},platform:'win32'},URL
 });
 events.ready();assert.equal(forks,0);assert.equal(window.url,'https://astha.example.invalid');
 let prevented=false;window.events['will-navigate']({preventDefault(){prevented=true;}},'https://astha.example.invalid/app/home.html');assert.equal(prevented,false);
 for(const target of ['http://localhost:3000','https://elsewhere.example.invalid','https://user:secret@astha.example.invalid']){
  prevented=false;window.events['will-navigate']({preventDefault(){prevented=true;}},target);assert.equal(prevented,true);
  prevented=false;window.events['will-redirect']({preventDefault(){prevented=true;}},target);assert.equal(prevented,true);
 }
});
