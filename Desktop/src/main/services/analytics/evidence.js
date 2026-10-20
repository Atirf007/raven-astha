'use strict';
const {createHash}=require('node:crypto');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const {restore,analysis}=require('./datasets');
const hash=value=>createHash('sha256').update(value).digest('hex');
// Only fixed application paths are read. No submitted filename or module is accepted.
function engineManifest(){return {id:'astha-science/1',files:['statistics.js','worker-entry.js'].map(name=>({name,sha256:hash(readFileSync(path.join(__dirname,name)))})),node:process.version,platform:process.platform,architecture:process.arch,dependencies:[],randomness:'none'};}
function canonical(value){
 if(value instanceof Date)return JSON.stringify(value.toISOString());
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
}
function evidence(study,snapshot,job,reviews=[]){
 const stored=typeof snapshot.dataset==='string'?JSON.parse(snapshot.dataset):snapshot.dataset;
 const normalized=restore(stored);
 const result=typeof job.result==='string'?JSON.parse(job.result):job.result;
 if(job.status!=='completed'||!result||normalized.hash!==snapshot.content_hash||result.snapshot_hash!==snapshot.content_hash||result.snapshot_id!==snapshot.id)throw Error('EVIDENCE_INTEGRITY');
 const parameters=analysis(normalized.data,job.method,result.parameters||{});
 if(result.method!==job.method||!result.result||!result.engine)throw Error('EVIDENCE_INCOMPLETE');
 const resultHash=hash(canonical(result));
 if(reviews.some(review=>review.result_hash!==resultHash))throw Error('EVIDENCE_INTEGRITY');
 const payload={schema:'astha-evidence/1',study:{name:study.name,question:study.question},snapshot:{version:snapshot.version,sha256:normalized.hash,dataset:normalized.data},recipe:{method:job.method,parameters,engine:result.engine},result,result_sha256:resultHash,reviews:reviews.map(review=>({decision:review.decision,note:review.note,reviewer:review.reviewer_name,reviewed_at:review.created_at,result_sha256:review.result_hash})),limitations:['Análise exploratória; revisão documental não autoriza uma alteração operacional.','Reexecução exige versão compatível do motor. O pacote contém dados, não programas ou credenciais.']};
 return {...payload,manifest:{algorithm:'SHA-256',canonicalization:'recursive-key-sort-json/1',payload_sha256:hash(canonical(payload))}};
}
function csv(data){
 const headers=data.kind==='life'?['subject_id','duration','event']:data.kind==='categories'?['subject_id','category','value']:['subject_id','value'];
 const cell=value=>{
  if(value===null)return '';
  // Spreadsheet formula protection applies to strings, not to actual numeric values.
  let text=String(value);if(typeof value==='string'&&/^[\s\u0000-\u001f\u007f\uFEFF]*[=+\-@]/u.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
 };
 return '\uFEFF'+[headers.map(cell).join(','),...data.rows.map(row=>headers.map(key=>cell(row[key])).join(','))].join('\r\n')+'\r\n';
}
module.exports={engineManifest,canonical,hash,evidence,csv};
