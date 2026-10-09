'use strict';
async function main(){
 let phase='profile',profile;
 try{
 process.chdir(__dirname);
 const requested=require('./security/web-startup').requestedProfile(process.argv.slice(2),process.env.ASTHA_WEB_PROFILE);
 profile=await require('./security/web-profile').select({requested});
 Object.assign(process.env,profile.env);
 process.env.ASTHA_ACTIVE_WEB_PROFILE=profile.name;
 console.log(profile.name==='local'?'ASTHA web: perfil local de testes selecionado.':'ASTHA web: perfil principal selecionado.');
 if(profile.name==='local'){
  let active=null;
  try{const response=await fetch('http://127.0.0.1:'+profile.env.PORT+'/api/health',{signal:AbortSignal.timeout(2000)});if(response.ok)active=await response.json();}catch(_){}
  if(active?.application==='astha-raven-web'&&active.environment==='local-test'){
   if(active.status==='operational'&&active.build===require('./security/web-build').fingerprint()){console.log('A API atualizada já está disponível em http://localhost:'+profile.env.PORT+'/app/login.html');return;}
   console.error('A instância ativa está desatualizada. Encerre-a com Ctrl+C no terminal antes de iniciar novamente.');process.exitCode=1;return;
  }
 }
 phase='server';await require('./server').startServer();
 }catch(error){const failure=new Error(require('./security/web-startup').failureMessage(error,phase,profile?.name));failure.code='WEB_START_FAILED';throw failure;}
}
if(require.main===module)main().catch(error=>{console.error(error.code==='WEB_START_FAILED'?error.message:'Não foi possível iniciar o web app.');process.exitCode=1;});
module.exports={main};
