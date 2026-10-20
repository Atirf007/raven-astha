const { parentPort,workerData }=require('node:worker_threads');
try{const result=require('../../renderer/js/sistema-model-import-validator').parse(workerData.bytes,workerData.extension);parentPort.postMessage({ok:true,result});}catch(error){parentPort.postMessage({ok:false,error:error.name==='SyntaxError'?'Conteúdo glTF inválido':error.message});}
