'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {requestedProfile,failureMessage}=require('../../api/security/web-startup');
const {select}=require('../../api/security/web-profile');
test('normal npm start explicitly chooses local over an inherited principal; legacy server.js changes nothing',async()=>{
 const scripts=require('../../api/package.json').scripts;
 assert.equal(scripts.start,'node start-web.js --profile=local');assert.equal(scripts['start:principal'],'node start-web.js --profile=principal');
 const requested=requestedProfile(['--profile=local','server.js'],'principal');assert.equal(requested,'local');const local={profilePath:()=>'/fixture/local',load:async()=>({PORT:'3000'})};assert.equal((await select({requested,production:false,platform:'win32',local,exists:async()=>true})).name,'local');
 await assert.rejects(select({requested,production:true,platform:'win32',local,exists:async()=>true}),/LOCAL_PROFILE_NOT_PRODUCTION/);
 assert.equal(requestedProfile(['--profile=principal'],'local'),'principal');assert.equal(requestedProfile([],'principal'),'principal');for(const args of [['unexpected'],['--profile=other'],['--profile=local','--profile=principal']])assert.throws(()=>requestedProfile(args),/WEB_START_ARGUMENT_INVALID/);
});
test('startup diagnostics distinguish TLS and protected profile failures without echoing arbitrary secret-bearing errors',()=>{
 assert.match(failureMessage(Error('DB_HOST remoto deve ser um nome DNS correspondente ao certificado TLS'),'server','principal'),/nome DNS/);
 assert.match(failureMessage(Error('LOCAL_PROFILE_MISSING'),'profile','local'),/usuário Windows/);
 assert.match(failureMessage(Error('LOCAL_PROFILE_NOT_PRODUCTION'),'profile','local'),/produção/);
 const secret='fixture-private-value';for(const phase of ['profile','server'])assert.ok(!failureMessage(Error(secret),phase,'principal').includes(secret));
 assert.match(failureMessage(Error(secret),'server','principal'),/API não conseguiu iniciar/);assert.match(failureMessage(Error(secret),'profile','local'),/carregar o perfil/);
});
