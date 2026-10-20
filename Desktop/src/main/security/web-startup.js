'use strict';
function requestedProfile(args,environment){
 let selected;
 for(const argument of args){
  // npm start server.js was the former documented invocation. It selects no profile.
  if(argument==='server.js')continue;
  if(!['--profile=local','--profile=principal'].includes(argument)||selected!==undefined)throw Error('WEB_START_ARGUMENT_INVALID');
  selected=argument.slice('--profile='.length);
 }
 return selected===undefined?environment:selected;
}
function failureMessage(error,phase,profile){
 const code=error?.code||error?.message;
 const messages={
  WEB_START_ARGUMENT_INVALID:'Argumento de inicialização inválido. Use npm start para o laboratório ou npm run start:principal para o banco principal.',
  WEB_PROFILE_INVALID:'Perfil web inválido. Use somente local ou principal.',
  LOCAL_PROFILE_NOT_PRODUCTION:'O laboratório não pode iniciar com NODE_ENV=production. Use npm run start:principal em produção; execute o laboratório em um terminal de desenvolvimento.',
  WINDOWS_PROFILE_REQUIRED:'O perfil local protegido exige este usuário Windows. Em outro ambiente, configure o perfil principal e use npm run start:principal.',
  LOCAL_PROFILE_MISSING:'O perfil local protegido não foi encontrado para este usuário Windows nem na cópia protegida desta instalação. Execute com o mesmo usuário Windows que preparou o laboratório e a instalação preparada. Nenhum banco alternativo foi usado.',
  LOCAL_PROFILE_DIRECTORY_UNAVAILABLE:'O Windows não informou uma pasta local válida para este usuário. Execute em uma sessão Windows com o perfil do usuário carregado.',
  LOCAL_PROFILE_INVALID:'O perfil local não corresponde à configuração segura do laboratório. Nenhum banco alternativo foi usado.',
  LOCAL_PROFILE_UNAVAILABLE:'Não foi possível abrir o perfil local protegido. Execute com o mesmo usuário Windows que preparou o laboratório. Nenhum banco alternativo foi usado.',
  LOCAL_PROFILE_TIMEOUT:'A abertura do perfil local excedeu o tempo limite. Tente novamente com o usuário Windows do laboratório.',
  'DB_HOST remoto deve ser um nome DNS correspondente ao certificado TLS':'O banco principal usa um endereço numérico remoto, incompatível com a validação TLS. Configure o nome DNS correspondente ao certificado. Para este laboratório, use npm start.'
 };
 if(Object.hasOwn(messages,code))return messages[code];
 if(phase==='server')return 'O perfil '+(profile==='local'?'local':'principal')+' foi selecionado, mas a API não conseguiu iniciar. Confira a configuração segura do banco e os requisitos do servidor. Nenhum banco alternativo foi usado.';
 return 'Não foi possível carregar o perfil web protegido. Nenhum banco alternativo foi usado.';
}
module.exports={requestedProfile,failureMessage};
