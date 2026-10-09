const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const express=require('../../api/node_modules/express');
process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');
let calls=0;
const pool={execute:async()=>{calls++;return [[]];}};
require.cache[require.resolve('../../api/database/connection')]={exports:{pool,readWithRetry:pool.execute}};
require.cache[require.resolve('../../api/middleware/auth')]={exports:(req,res,next)=>{req.user={id:7,org_id:'tenant-a'};next();}};
const app=express();app.set('trust proxy','loopback');app.use(express.json());
app.post('/limited',require('../../api/middleware/rateLimitByUser'),(_req,res)=>res.status(401).json({error:'Credenciais inválidas'}));
app.use('/auth',require('../../api/routes/auth'));
const server=app.listen(0,'127.0.0.1');
after(()=>new Promise(resolve=>server.close(resolve)));
async function post(path,body,ip='192.0.2.1'){
 if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
 return fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':ip},body:JSON.stringify(body)});
}
test('account attempts stay limited across different source IPs and email casing',async()=>{
 for(let i=0;i<10;i++)assert.equal((await post('/limited',{email:i%2?'victim@example.invalid':' VICTIM@example.invalid '},`192.0.2.${i+1}`)).status,401);
 const blocked=await post('/limited',{email:'victim@example.invalid'},'192.0.2.200');
 assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);
 assert.equal((await post('/limited',{email:'other@example.invalid'},'192.0.2.200')).status,401);
});
test('register and password change enforce policy before touching the database',async()=>{
 calls=0;
 assert.equal((await post('/auth/register',{name:'Test',email:'test@example.invalid',password:'short'})).status,400);
 for(const password of [[], 'a'.repeat(73), 'short'])assert.equal((await post('/auth/change-password',{current_password:'valid',new_password:password})).status,400);
 assert.equal(calls,0);
});
test('nonexistent account login returns generic credentials failure',async()=>{
 const response=await post('/auth/login',{email:'absent@example.invalid',password:'An existing credential'});
 assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'Credenciais inválidas'});
});
