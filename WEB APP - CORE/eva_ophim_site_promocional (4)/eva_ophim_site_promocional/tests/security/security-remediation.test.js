const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const express=require('../../api/node_modules/express');
const {validPassword}=require('../../api/security/password-policy');
const tls=require('../../api/security/database-tls');
const calls=[];
require.cache[require.resolve('../../api/database/connection')]={exports:{pool:{execute:async(sql,args)=>{calls.push({sql,args});return sql.startsWith('SELECT')?[[]]:[{insertId:123}];}}}};
require.cache[require.resolve('../../api/middleware/auth')]={exports:(req,res,next)=>{
 if(req.headers['x-anonymous'])return res.sendStatus(401);
 req.user={id:7,org_id:req.headers['x-org']||'tenant-a',role:'superadmin'};next();
}};
const app=express();app.use(express.json());app.use(require('../../api/middleware/attackGuard'));
app.use('/contact',require('../../api/routes/contact'));
app.post('/text',(req,res)=>res.json(req.body));
const server=app.listen(0,'127.0.0.1');
after(()=>new Promise(resolve=>server.close(resolve)));
async function request(path,body,headers={},method=body?'POST':'GET'){
 if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
 return fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{'content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});
}
test('remote TLS cannot be disabled and verifies the server identity',()=>{
 const options=tls({DB_HOST:'db.example.invalid',DB_SSL_REQUIRED:'false'});
 assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(options.ssl.verifyIdentity,true);
 assert.equal(options.ssl.minVersion,'TLSv1.2');assert.deepEqual(tls({DB_HOST:'127.0.0.1'}),{});
 assert.throws(()=>tls({DB_HOST:'remote',DB_SSL_CA_FILE:'__nonexistent_ca__'}));
});
test('new passwords reject weak, non-string and bcrypt truncation inputs',()=>{
 for(const value of ['short', 'a'.repeat(15), 'password123456789', 'é'.repeat(40), [], null]) assert.equal(validPassword(value),false);
 assert.equal(validPassword('Uma frase privada 2026!'),true);
});
test('text and forged API submissions reject active XSS and common SQL payloads',async()=>{
 for(const value of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>',"x'; DROP TABLE users; --", "' OR 1=1 --",'UNION SELECT password_hash FROM users','javascript:alert(1)']) {
  assert.equal((await request('/text',{description:value})).status,400,value);
 }
 assert.equal((await request('/text',{description:'Peça SELECT e O\'Brien — manutenção'})).status,200);
 assert.equal((await request('/text',{password:"a UNION SELECT credential"})).status,200);
});
test('tenant superadmins and unauthenticated requests cannot read global contacts',async()=>{
 delete process.env.SUPPORT_ADMIN_IDENTITIES;calls.length=0;
 assert.equal((await request('/contact')).status,403);
 assert.equal((await request('/contact',null,{'x-anonymous':'yes'})).status,401);
 assert.equal((await request('/contact/1/read',{org_id:'platform',user_id:7},{},'PATCH')).status,403);
 assert.equal(calls.length,0);
});
test('support access binds both organization and live identity; contact receipt hides database IDs',async()=>{
 process.env.SUPPORT_ADMIN_IDENTITIES=JSON.stringify([{org_id:'tenant-a',user_id:7}]);
 assert.equal((await request('/contact',null,{'x-org':'tenant-b'})).status,403);
 assert.equal((await request('/contact')).status,200);
 const response=await request('/contact',{name:"O'Brien",email:'test@example.invalid',message:'Consulta de suporte'});
 assert.equal(response.status,201);assert.equal((await response.json()).id,undefined);
 assert.equal(calls.at(-1).args[0],"O'Brien");assert.ok(calls.at(-1).sql.includes('VALUES (?, ?, ?, ?)'));
 delete process.env.SUPPORT_ADMIN_IDENTITIES;
});
