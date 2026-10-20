importScripts('./sistema-model-import-validator.js');
self.onmessage=event=>{try{self.postMessage({ok:true,result:ASTHAModelImportValidator.parse(event.data.bytes,event.data.extension)});}catch(error){self.postMessage({ok:false,error:error.name==='SyntaxError'?'Conteúdo glTF inválido':error.message});}self.close();};
