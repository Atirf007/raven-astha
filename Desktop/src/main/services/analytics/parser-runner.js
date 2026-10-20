'use strict';
const {spawn}=require('node:child_process');
const {readFileSync}=require('node:fs');
const {randomUUID,createHash}=require('node:crypto');
const path=require('node:path');
const {validateTable}=require('./imports');
let cleanupBroken=false;
function configured(){return !cleanupBroken&&process.env.ANALYTICS_FILE_IMPORTS==='true'&&/^node@sha256:[a-f0-9]{64}$/.test(process.env.ANALYTICS_PARSER_IMAGE||'');}
function command(args,{input,signal,timeoutMs=20000,maxBytes=4*1024*1024,launch=spawn}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(Error('CANCELLED'));
  const child=launch(process.env.ANALYTICS_DOCKER_PATH||'docker',args,{shell:false,windowsHide:true,cwd:__dirname,stdio:['pipe','pipe','ignore'],env:{PATH:process.env.PATH||'',SystemRoot:process.env.SystemRoot||'',WINDIR:process.env.WINDIR||'',USERPROFILE:process.env.USERPROFILE||'',HOME:process.env.HOME||''}});
  let size=0,done=false;const chunks=[],cancel=()=>finish(Error('CANCELLED')),timer=setTimeout(()=>finish(Error('PARSER_TIMEOUT')),timeoutMs);
  function finish(error,value){if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(error)child.kill();error?reject(error):resolve(value);}
  signal?.addEventListener('abort',cancel,{once:true});child.on('error',()=>finish(Error('PARSER_UNAVAILABLE')));child.stdin.on('error',()=>finish(Error('PARSER_UNAVAILABLE')));
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>maxBytes)return finish(Error('PARSER_OUTPUT_LIMIT'));chunks.push(chunk);});child.on('close',code=>finish(null,{code,output:Buffer.concat(chunks).toString('utf8')}));child.stdin.end(input||'');
  if(signal?.aborted)cancel();
 });
}
let active=0;
async function parse(input,{signal,launch=spawn}={}){
 if(!configured())throw Error('PARSER_UNAVAILABLE');if(active>=2)throw Error('PARSER_BUSY');
 const source=readFileSync(path.join(__dirname,'file-parser.js'),'utf8');
 active++;
 const name='astha-parser-'+randomUUID(),image=process.env.ANALYTICS_PARSER_IMAGE;let created=false;
 try{
  // No mounts, host secrets, network, writable filesystem, capabilities or arbitrary executable input.
  const result=await command(['create','--name',name,'--label=com.astha.component=analytics-parser','--pull=never','--interactive','--network=none','--read-only','--user=65534:65534','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=32','--memory=128m','--memory-swap=128m','--cpus=0.5','--log-driver=none','--env=NODE_OPTIONS=','--entrypoint=node',image,'--max-old-space-size=64','-e',source+'\nmodule.exports.readInput();'],{signal,launch});
  // If creation was interrupted, finally still removes the generated name; there is no host fallback.
  if(result.code!==0)throw Error('PARSER_UNAVAILABLE');created=true;
  const out=await command(['start','--attach','--interactive',name],{input:JSON.stringify(input),signal,launch});
  if(out.code!==0){const error=Error('Arquivo inválido. Use UTF-8, células simples e cabeçalho único; até 4.000 linhas e 64 colunas.');error.status=400;throw error;}
  let parsed;try{parsed=JSON.parse(out.output);}catch(_){throw Error('PARSER_INVALID_OUTPUT');}
  if(typeof parsed.runtime!=='string'||!/^v(2[4-9]|[3-9]\d)\./.test(parsed.runtime))throw Error('PARSER_INVALID_OUTPUT');
  return {table:validateTable(parsed.table),engine:{image,source_sha256:createHash('sha256').update(source).digest('hex'),runtime:parsed.runtime,isolation:'container-no-network-read-only'}};
 }finally{
  try{const removed=await command(['rm','--force',name],{timeoutMs:5000,maxBytes:8192,launch});if(created&&removed.code!==0){cleanupBroken=true;throw Error('PARSER_CLEANUP_FAILED');}}catch(error){cleanupBroken=true;throw error;}finally{active--;}
 }
}
module.exports={configured,parse};
