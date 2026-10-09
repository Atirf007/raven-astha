'use strict';
const {fields,invalid}=require('./datasets');
const {canonical,hash}=require('./evidence');

function profile(input){
 fields(input,['format','identifiers','delimiter','decimal']);
 if(!['csv','json-data','json-summary','package'].includes(input.format)||typeof input.identifiers!=='boolean')invalid('Escolha formato e política de identificadores.');
 if(input.format==='csv'){
  if(![',',';'].includes(input.delimiter)||!['point','comma'].includes(input.decimal))invalid('Perfil CSV inválido.');
 }else if(input.delimiter!==undefined||input.decimal!==undefined)invalid('Separador e decimal se aplicam somente ao CSV.');
 if(input.format==='package'&&!input.identifiers)invalid('O pacote completo preserva identidades e proveniência. Escolha dados ou resumo para minimizar identificadores.');
 return {...input};
}
function artifact(pack,input){
 const options=profile(input),dataset=pack.snapshot.dataset;
 const warnings=['Download privado; remover identificadores não garante anonimização. Variáveis, valores e contexto podem permitir reidentificação.'];
 let content,mime,filename,preview;
 const rows=dataset.rows.map(({subject_id,...values})=>options.identifiers?{subject_id,...values}:values);
 if(options.format==='csv'){
  const headers=[...(options.identifiers?['subject_id']:[]),...(dataset.kind==='life'?['duration','event']:dataset.kind==='categories'?['category','value']:['value'])];
  const cell=value=>{if(value===null)return '';let string=typeof value==='number'&&options.decimal==='comma'?String(value).replace('.',','):String(value);if(typeof value==='string'&&/^[\s\u0000-\u001f\u007f\uFEFF]*[=+\-@]/u.test(string))string="'"+string;return '"'+string.replace(/"/g,'""')+'"';};
  const lines=[headers,...rows.map(row=>headers.map(key=>row[key]))].map(row=>row.map(cell).join(options.delimiter));
  content='\uFEFF'+lines.join('\r\n')+'\r\n';preview=lines.slice(0,6).join('\n');mime='text/csv;charset=utf-8';filename='astha-observacoes.csv';
  warnings.push('CSV contém observações, não o relatório científico completo. Unidade e versão constam na prévia; campos vazios representam ausentes. Textos com prefixo de fórmula são protegidos.');
 }else{
  let payload;
  if(options.format==='package')payload=pack;
  else if(options.format==='json-data')payload={schema:'astha-data-export/1',snapshot:{version:pack.snapshot.version,sha256:pack.snapshot.sha256},kind:dataset.kind,variable:dataset.variable,rows,...(options.identifiers?{source:dataset.source,provenance:dataset.provenance}:{}),limitations:[...pack.limitations,...warnings]};
  else payload={schema:'astha-summary-export/1',...(options.identifiers?{study:pack.study}:{}),snapshot:{version:pack.snapshot.version,sha256:pack.snapshot.sha256},variable:dataset.variable,recipe:pack.recipe,result:pack.result.result,result_sha256:pack.result_sha256,limitations:[...pack.limitations,...warnings]};
  content=JSON.stringify(payload,null,2);preview=JSON.stringify({schema:payload.schema,version:pack.snapshot.version,variable:dataset.variable,observations:options.format==='json-summary'?0:rows.length,identifiers:options.identifiers},null,2);mime='application/json';filename=options.format==='package'?'astha-evidencias.json':options.format==='json-data'?'astha-observacoes.json':'astha-resumo.json';
 }
 return {schema:'astha-artifact/1',filename,mime,bytes:Buffer.byteLength(content),sha256:hash(content),version:pack.snapshot.version,variable:dataset.variable,observations:options.format==='json-summary'?0:rows.length,identifiers:options.identifiers,warnings,preview,content,profile_sha256:hash(canonical(options))};
}
module.exports={profile,artifact};
