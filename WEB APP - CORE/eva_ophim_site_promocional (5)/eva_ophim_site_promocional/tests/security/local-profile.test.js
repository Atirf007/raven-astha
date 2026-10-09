'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{validate,profilePath}=require('../../api/security/local-profile');
const profile=()=>({DB_HOST:'127.0.0.1',DB_PORT:'3306',DB_NAME:'astha_raven_lab',DB_USER:'astha_lab_web',DB_PASSWORD:'fixture-only',DB_SSL_REQUIRED:'false',JWT_SECRET:'x'.repeat(64),HOST:'127.0.0.1',PORT:'3001',NODE_ENV:'development'});
test('local profile cannot enable remote DB, root runtime, public listener or arbitrary environment',()=>{assert.equal(validate(profile()).PORT,'3001');assert.equal(validate({...profile(),PORT:'3000'}).PORT,'3000');for(const change of [{PORT:'8080'},{DB_HOST:'example.com'},{DB_USER:'root'},{HOST:'0.0.0.0'},{DB_NAME:'evah_ophim_db'},{NODE_ENV:'production'},{NODE_OPTIONS:'--inspect'},{JWT_SECRET:undefined}])assert.throws(()=>validate({...profile(),...change}));});
test('protected profile uses the Windows known folder and rejects invalid locations',async()=>{
 assert.equal(await profilePath({platform:'win32',discover:async()=> 'C:\\Users\\fixture\\AppData\\Local',exists:async()=>false}),'C:\\Users\\fixture\\AppData\\Local\\ASTHA-RAVEN\\local-web.dpapi');
 for(const directory of ['',undefined,'relative','\\\\remote\\share','C:\\bad\0path'])await assert.rejects(profilePath({platform:'win32',discover:async()=>directory}),/LOCAL_PROFILE_DIRECTORY_UNAVAILABLE/);
 await assert.rejects(profilePath({platform:'linux'}),/WINDOWS_PROFILE_REQUIRED/);
 await assert.rejects(profilePath({platform:'win32',discover:async()=>{throw Error('discovery failed');}}),/discovery failed/);
});
test('installation copy is used only when the user location is missing; access errors do not fall back',async()=>{
 const user='C:\\Users\\fixture\\AppData\\Local\\ASTHA-RAVEN\\local-web.dpapi',workspace='C:\\app\\api\\.local\\local-web.dpapi';
 const opts={platform:'win32',discover:async()=> 'C:\\Users\\fixture\\AppData\\Local',workspace};
 assert.equal(await profilePath({...opts,exists:async file=>file===workspace}),workspace);
 assert.equal(await profilePath({...opts,exists:async()=>true}),user);
 assert.equal(await profilePath({...opts,exists:async()=>false}),user);
 await assert.rejects(profilePath({...opts,exists:async()=>{throw Error('EACCES');}}),/EACCES/);
});
