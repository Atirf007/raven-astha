'use strict';
const {dataset,fields,text,invalid}=require('./datasets');
const {createHash}=require('node:crypto');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function upload(input){
 fields(input,['format','delimiter','content','origin']);
 if(!['csv','json'].includes(input.format)||!text(input.origin,200)||input.format==='csv'&&![',',';','\t'].includes(input.delimiter)||input.format==='json'&&input.delimiter!==undefined)invalid('Informe origem, formato CSV/JSON e separador explícito.');
 if(typeof input.content!=='string'||!input.content.length||input.content.length>2796204||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.content))invalid('Arquivo inválido ou maior que 2 MiB.');
 const raw=Buffer.from(input.content,'base64');if(!raw.length||raw.length>2097152)invalid('Arquivo inválido ou maior que 2 MiB.');
 return {raw,hash:createHash('sha256').update(raw).digest('hex'),format:input.format,delimiter:input.delimiter,origin:input.origin.trim()};
}
function validateTable(table){
 fields(table,['schema','columns','rows']);
 if(table.schema!=='astha-parsed-file/1'||!Array.isArray(table.columns)||!table.columns.length||table.columns.length>64||table.columns.some(name=>!text(name,100)||/[\u0000-\u001f]/.test(name)||['__proto__','constructor','prototype'].includes(name))||new Set(table.columns).size!==table.columns.length||!Array.isArray(table.rows)||!table.rows.length||table.rows.length>4000)invalid('Estrutura do arquivo não suportada.');
 if(table.rows.some(row=>!Array.isArray(row)||row.length!==table.columns.length||row.some(value=>!(value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=2048&&!value.includes('\0')||typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e100))))invalid('Arquivo deve conter células simples, até 4.000 linhas e 64 colunas.');
 if(Buffer.byteLength(JSON.stringify(table))>4*1024*1024)invalid('Prévia excede o limite permitido.');return table;
}
function provenance(value){
 fields(value,['import_id','raw_sha256','format','origin','mapping','parser']);
 if(!UUID.test(value.import_id)||!/^([a-f0-9]{64})$/.test(value.raw_sha256)||!['csv','json'].includes(value.format)||!text(value.origin,200))invalid('Origem da importação inválida.');
 fields(value.parser,['image','source_sha256','runtime','isolation']);
 if(!/^node@sha256:[a-f0-9]{64}$/.test(value.parser.image)||!/^[a-f0-9]{64}$/.test(value.parser.source_sha256)||typeof value.parser.runtime!=='string'||!/^v(2[4-9]|[3-9]\d)\./.test(value.parser.runtime)||value.parser.isolation!=='container-no-network-read-only')invalid('Manifesto do parser inválido.');
 validateMapping(value.mapping);const m=value.mapping;
 const mapping={kind:m.kind,variable:{name:m.variable.name.trim(),unit:m.variable.unit.trim()},subject_column:m.subject_column,value_column:m.value_column,decimal:m.decimal};
 if(m.kind==='life')Object.assign(mapping,{event_column:m.event_column,failure_value:m.failure_value.trim(),censored_value:m.censored_value.trim()});
 return {import_id:value.import_id,raw_sha256:value.raw_sha256,format:value.format,origin:value.origin.trim(),mapping,parser:{image:value.parser.image,source_sha256:value.parser.source_sha256,runtime:value.parser.runtime,isolation:value.parser.isolation}};
}
function validateMapping(mapping){
 fields(mapping,['kind','variable','subject_column','value_column','event_column','decimal','failure_value','censored_value']);fields(mapping.variable,['name','unit']);
 if(!['measurements','life'].includes(mapping.kind)||!text(mapping.variable.name,100)||!text(mapping.variable.unit,24)||!text(mapping.subject_column,100)||!text(mapping.value_column,100)||mapping.subject_column===mapping.value_column||!['.',','].includes(mapping.decimal))invalid('Selecione tipo, unidade, colunas distintas e separador decimal.');
 if(mapping.kind==='life'){if(!text(mapping.event_column,100)||[mapping.subject_column,mapping.value_column].includes(mapping.event_column)||!text(mapping.failure_value,100)||!text(mapping.censored_value,100)||mapping.failure_value.trim()===mapping.censored_value.trim())invalid('Vida exige coluna de evento e valores distintos para falha e censura.');}
 else if(['event_column','failure_value','censored_value'].some(key=>mapping[key]!==undefined))invalid('Medições não utilizam campos de censura.');
}
function number(value,decimal,missing){
 if(value===null||value===''){if(missing)return null;invalid('Duração ausente; corrija o arquivo.');}
 if(typeof value==='number')return value;
 if(typeof value!=='string'||!value.trim())invalid('Número ausente ou inválido; não foi convertido em zero.');
 const s=value.trim(),pattern=decimal==='.'?/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/:/^[+-]?(?:\d+(?:,\d*)?|,\d+)(?:[eE][+-]?\d+)?$/;
 if(!pattern.test(s))invalid('Número ambíguo ou inválido. Não use separador de milhar.');const n=Number(decimal===','?s.replace(',','.'):s);if(!Number.isFinite(n)||Math.abs(n)>1e100)invalid('Número fora do limite.');return n;
}
function mapped(table,mapping,source){
 validateTable(table);validateMapping(mapping);
 const index=name=>{const i=table.columns.indexOf(name);if(i<0)invalid('Coluna mapeada não existe no arquivo.');return i;},subject=index(mapping.subject_column),value=index(mapping.value_column),event=mapping.kind==='life'?index(mapping.event_column):null;
 const rows=table.rows.map(row=>{
  // External IDs remain strings and never become operational database identifiers.
  if(typeof row[subject]!=='string'||!row[subject].trim())invalid('Identificadores devem ser texto não vazio; números JSON podem perder zeros ou precisão.');
  if(mapping.kind==='measurements')return {subject_id:row[subject],value:number(row[value],mapping.decimal,true)};
  const token=String(row[event]??'').trim();if(![mapping.failure_value.trim(),mapping.censored_value.trim()].includes(token))invalid('Evento desconhecido; indique falha ou censura explicitamente em cada linha.');
  return {subject_id:row[subject],duration:number(row[value],mapping.decimal,false),event:token===mapping.failure_value.trim()};
 });
 return dataset({kind:mapping.kind,variable:mapping.variable,rows},{source:'file-import',provenance:provenance({...source,mapping})});
}
module.exports={upload,validateTable,mapped,provenance};
