const {test}=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');
const express=require('../../api/node_modules/express');const {signToken}=require('../../api/security/tokens');
const {applicationRateLimit}=require('../../api/middleware/applicationRateLimit');
test('verified users have separate read and write quotas; forged identities remain network limited',async()=>{
 const app=express();app.use(applicationRateLimit({readLimit:3,writeLimit:1,anonymousLimit:1}));app.all('/',(_req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const tokenA=signToken({id:1,org_id:'a',role:'viewer'}),tokenB=signToken({id:2,org_id:'a',role:'viewer'});
 const request=(token,method='GET')=>fetch(`http://127.0.0.1:${server.address().port}/`,{method,headers:token?{authorization:'Bearer '+token}:{}});
 try{
  for(let i=0;i<3;i++)assert.equal((await request(tokenA)).status,200);
  const blocked=await request(tokenA);assert.equal(blocked.status,429);assert.ok(blocked.headers.get('Retry-After'));assert.ok((await blocked.json()).error.includes('requisições'));
  assert.equal((await request(tokenB)).status,200);
  assert.equal((await request(tokenA,'POST')).status,200);assert.equal((await request(tokenA,'POST')).status,429);
  assert.equal((await request('forged')).status,200);assert.equal((await request('another-forged')).status,429);
 }finally{await new Promise(r=>server.close(r));}
});
