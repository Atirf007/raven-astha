// Isolated UI fixture only: no real credentials, database, or production routes.
const express=require('../../api/node_modules/express'),path=require('node:path');
const app=express();
const user={id:1,name:'Teste de primeiro acesso',role:'admin',org_id:'EMPTY_UI_TEST'};
app.get('/start',(_req,res)=>res.type('html').send('<!doctype html><meta charset="utf-8"><script>localStorage.setItem("astha_token","ui-fixture-only");localStorage.setItem("astha_user",'+JSON.stringify(JSON.stringify(user))+');location.replace("/app/home.html");</script>'));
app.get('/api/auth/me',(_req,res)=>res.json(user));
app.get('/api/org/me',(_req,res)=>res.json({id:user.org_id,name:'TESTE — Organização vazia',plan:'Enterprise'}));
app.get('/api/warehouse/map-hub',(_req,res)=>res.json({maps:[]}));
app.get('/api/*',(_req,res)=>res.json([]));
app.use('/app',express.static(path.join(__dirname,'../../app'),{dotfiles:'deny'}));
const server=app.listen(4174,'127.0.0.1',()=>console.log('EMPTY_WAREHOUSE_PREVIEW_READY'));
setTimeout(()=>server.close(),300000).unref();
