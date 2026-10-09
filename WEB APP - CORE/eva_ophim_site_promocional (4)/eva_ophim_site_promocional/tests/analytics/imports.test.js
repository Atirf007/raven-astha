'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {parseFile}=require('../../api/services/analytics/file-parser');
const {upload,mapped}=require('../../api/services/analytics/imports');
const {restore}=require('../../api/services/analytics/datasets');
const content=value=>Buffer.from(value).toString('base64');
const source={import_id:randomUUID(),raw_sha256:createHash('sha256').update('raw').digest('hex'),format:'csv',origin:'Bancada externa',parser:{image:'node@sha256:'+'a'.repeat(64),source_sha256:'b'.repeat(64),runtime:'v24.19.0',isolation:'container-no-network-read-only'}};
const mapping={kind:'measurements',variable:{name:'Temperatura',unit:'C'},subject_column:'id',value_column:'valor',decimal:','};
test('CSV parser preserves quoted delimiters, escaped quotes, newlines, UTF-8 and empty cells',()=>{
 const table=parseFile({format:'csv',delimiter:';',content:content('\uFEFFid;valor;nota\r\n0001;0;"a;b"\r\n0002;;"linha\ncom ""aspas"""\r\n')});
 assert.deepEqual(table.columns,['id','valor','nota']);assert.deepEqual(table.rows,[['0001','0','a;b'],['0002','','linha\ncom "aspas"']]);
 const result=mapped(table,mapping,source);assert.equal(result.data.rows[0].value,0);assert.equal(result.data.rows[1].value,null);assert.equal(result.data.source,'file-import');assert.equal(result.data.rows[0].subject_id,'0001');
});
test('parser cancellation and oversized output remove only the generated container; cleanup failure closes admission',async()=>{
 const modulePath=require.resolve('../../api/services/analytics/parser-runner');delete require.cache[modulePath];
 const runner=require(modulePath),oldEnabled=process.env.ANALYTICS_FILE_IMPORTS,oldImage=process.env.ANALYTICS_PARSER_IMAGE;
 process.env.ANALYTICS_FILE_IMPORTS='true';process.env.ANALYTICS_PARSER_IMAGE='node@sha256:'+'a'.repeat(64);
 let mode='cancel',controller=new AbortController();const calls=[],killed=[];
 function launch(executable,args){
  calls.push(args);const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.kill=()=>killed.push(args[0]);
  if(args[0]==='create'&&mode==='cancel')controller.abort();
  child.stdin.on('finish',()=>setImmediate(()=>{
   if(args[0]==='start'&&mode==='overflow')child.stdout.write(Buffer.alloc(4*1024*1024+1));
   child.emit('close',args[0]==='rm'&&mode==='cleanup-failure'?1:0);
  }));return child;
 }
 try{
  await assert.rejects(runner.parse({},{launch,signal:controller.signal}),/CANCELLED/);
  assert(killed.includes('create'));assert.equal(calls.at(-1)[0],'rm');assert.equal(calls.at(-1)[2],calls[0][2]);
  mode='overflow';await assert.rejects(runner.parse({},{launch}),/OUTPUT_LIMIT/);assert(killed.includes('start'));assert.equal(calls.at(-1)[0],'rm');
  mode='cleanup-failure';await assert.rejects(runner.parse({},{launch}),/CLEANUP_FAILED/);assert.equal(runner.configured(),false);
  const count=calls.length;await assert.rejects(runner.parse({},{launch}),/UNAVAILABLE/);assert.equal(calls.length,count);
 }finally{delete require.cache[modulePath];oldEnabled===undefined?delete process.env.ANALYTICS_FILE_IMPORTS:process.env.ANALYTICS_FILE_IMPORTS=oldEnabled;oldImage===undefined?delete process.env.ANALYTICS_PARSER_IMAGE:process.env.ANALYTICS_PARSER_IMAGE=oldImage;}
});
test('parser rejects malformed quotes, duplicate/prototype headers, ragged rows and invalid UTF-8',()=>{
 for(const raw of ['id;id\na;b','id;valor\na','id;valor\n"unterminated;1','id;valor\n"a"x;1','__proto__;valor\na;1','id;valor\na"b;1'])assert.throws(()=>parseFile({format:'csv',delimiter:';',content:content(raw)}));
 assert.throws(()=>parseFile({format:'csv',delimiter:';',content:Buffer.from([0xff,0xfe]).toString('base64')}));
 assert.throws(()=>parseFile({format:'csv',delimiter:';',content:content('id;valor\n'+Array(4001).fill('a;1').join('\n'))}));
 assert.throws(()=>upload({format:'csv',delimiter:';',content:Buffer.alloc(2097153).toString('base64'),origin:'X'}));
 assert.throws(()=>upload({format:'json',delimiter:';',content:content('[]'),origin:'X'}));
});
test('JSON accepts only flat consistent typed records and never converts numeric external IDs',()=>{
 const table=parseFile({format:'json',content:content('[{"id":"0001","valor":0},{"valor":null,"id":"0002"}]')});assert.deepEqual(table.rows,[['0001',0],['0002',null]]);
 for(const raw of ['[{"id":"A","valor":{}}]','[{"id":"A","valor":1},{"id":"B"}]','[{"__proto__":"A","valor":1}]','{"id":"A"}','[{"id":"A","valor":0,"valor":10}]','[{"id":"A","\\u0069d":"B"}]','[{"id":"A","valor":1},]','[{"id":"A","valor":1,}]','[{"id":"A","valor":'+ '['.repeat(10000)+'0'+']'.repeat(10000)+'}]'])assert.throws(()=>parseFile({format:'json',content:content(raw)}));
 const escaped=parseFile({format:'json',content:content('[{"id":"A\\\"B","valor":-1.5e2,"nota":"\\u00e7"}]')});assert.deepEqual(escaped.rows,[['A"B',-150,'ç']]);
 const numeric=parseFile({format:'json',content:content('[{"id":123,"valor":1}]')});assert.throws(()=>mapped(numeric,mapping,source),/Identificadores/);
});
test('mapping refuses ambiguous numbers, duplicate subjects and unknown censoring without coercion',()=>{
 const table=raw=>parseFile({format:'csv',delimiter:';',content:content(raw)});
 assert.equal(mapped(table('id;valor\nA;12,5'),mapping,source).data.rows[0].value,12.5);
 for(const value of ['1.234,50','1,234.50','false','=1+1',' '])assert.throws(()=>mapped(table('id;valor\nA;'+value),mapping,source));
 assert.throws(()=>mapped(table('id;valor\nA;1\nA;2'),mapping,source),/repetida/);
 const life={kind:'life',variable:{name:'Vida',unit:'h'},subject_column:'id',value_column:'tempo',event_column:'evento',decimal:'.',failure_value:'falha',censored_value:'censurado'};
 assert.deepEqual(mapped(table('id;tempo;evento\nA;10;falha\nB;20;censurado'),life,source).data.rows.map(row=>row.event),[true,false]);
 for(const token of ['','unknown','0'])assert.throws(()=>mapped(table('id;tempo;evento\nA;10;'+token),life,source),/desconhecido/);
 assert.throws(()=>mapped(table('id;tempo;evento\nA;0;falha'),life,source),/positiva/);
});
test('import provenance survives database key ordering and participates in immutable evidence hashes',()=>{
 const table=parseFile({format:'csv',delimiter:';',content:content('id;valor\nA;10,5')});const data=mapped(table,mapping,source);
 function reordered(value){return value&&typeof value==='object'?(Array.isArray(value)?value.map(reordered):Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reordered(v)]))):value;}
 assert.equal(restore(reordered(data.data)).hash,data.hash);
 const modified=structuredClone(data.data);modified.provenance.origin='Outra bancada';assert.notEqual(restore(modified).hash,data.hash);
 assert.throws(()=>restore({...data.data,source:'manual-entry'}),/inválida/);
});
test('container adapter uses only a pinned image, no network/mounts/secrets and cleans up after success/failure',async()=>{
 const runner=require('../../api/services/analytics/parser-runner'),oldEnabled=process.env.ANALYTICS_FILE_IMPORTS,oldImage=process.env.ANALYTICS_PARSER_IMAGE;
 process.env.ANALYTICS_FILE_IMPORTS='true';process.env.ANALYTICS_PARSER_IMAGE='node@sha256:'+'a'.repeat(64);
 const calls=[],table=parseFile({format:'csv',delimiter:';',content:content('id;valor\nA;1')});let code=0;
 function launch(executable,args,options){calls.push({executable,args,options});const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.kill=()=>{};child.stdin.on('finish',()=>setImmediate(()=>{if(args[0]==='start'&&code===0)child.stdout.write(JSON.stringify({runtime:'v24.19.0',table}));child.emit('close',args[0]==='start'?code:0);}));return child;}
 try{
  const result=await runner.parse({format:'csv',delimiter:';',content:content('id;valor\nA;1')},{launch});assert.deepEqual(result.table,table);
  const create=calls[0];for(const required of ['--network=none','--read-only','--user=65534:65534','--cap-drop=ALL','--security-opt=no-new-privileges','--memory=128m','--cpus=0.5','--pull=never'])assert(create.args.includes(required));
  assert(!create.args.some(arg=>arg.startsWith('--mount')||arg.startsWith('--volume')));assert.equal(create.options.shell,false);assert(!Object.hasOwn(create.options.env,'JWT_SECRET'));assert.equal(calls.at(-1).args[0],'rm');
  code=1;await assert.rejects(runner.parse({},{launch}),/Arquivo inválido/);assert.equal(calls.at(-1).args[0],'rm');
  process.env.ANALYTICS_PARSER_IMAGE='node:latest';assert.equal(runner.configured(),false);await assert.rejects(runner.parse({},{launch}),/UNAVAILABLE/);
 }finally{oldEnabled===undefined?delete process.env.ANALYTICS_FILE_IMPORTS:process.env.ANALYTICS_FILE_IMPORTS=oldEnabled;oldImage===undefined?delete process.env.ANALYTICS_PARSER_IMAGE:process.env.ANALYTICS_PARSER_IMAGE=oldImage;}
});
