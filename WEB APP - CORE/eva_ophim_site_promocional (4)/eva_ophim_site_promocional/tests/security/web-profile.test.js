'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{select}=require('../../api/security/web-profile');
test('prepared local web profile is used by normal start, with no silent fallback after decryption errors',async()=>{
 const local={profilePath:()=>'/fixture/local',load:async()=>({PORT:'3000'})};
 const opts={platform:'win32',production:false,requested:undefined,local,exists:async()=>true};
 assert.deepEqual(await select(opts),{name:'local',env:{PORT:'3000'}});
 assert.equal((await select({...opts,requested:'principal'})).name,'principal');
 assert.equal((await select({...opts,production:true})).name,'principal');
 assert.equal((await select({...opts,exists:async()=>false})).name,'principal');
 await assert.rejects(select({...opts,requested:'local',exists:async()=>false}),/LOCAL_PROFILE_MISSING/);
 await assert.rejects(select({...opts,requested:'local',production:true}),/LOCAL_PROFILE_NOT_PRODUCTION/);
 await assert.rejects(select({...opts,requested:'anything'}),/WEB_PROFILE_INVALID/);
 await assert.rejects(select({...opts,local:{...local,load:async()=>{throw Error('decrypt');}}}),/decrypt/);
});
