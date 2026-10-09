'use strict';
// Explicit local laboratory. Never falls back silently from a remote database.
async function main(){process.env.ASTHA_WEB_PROFILE='local';await require('./start-web').main();}
main().catch(error=>{console.error(error.code==='WEB_START_FAILED'?error.message:'Perfil local indisponível. Prepare o laboratório antes de iniciar.');process.exitCode=1;});
