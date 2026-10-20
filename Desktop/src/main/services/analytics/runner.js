'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
const {analysis}=require('./datasets');
const {engineManifest}=require('./evidence');
function run(data,method,parameters,{signal,timeoutMs=15000}={}){
 parameters=analysis(data,method,parameters);
 if(process.versions.electron||Number(process.versions.node.split('.')[0])<24)return Promise.reject(Error('RUNNER_UNAVAILABLE'));
 if(signal?.aborted)return Promise.reject(Error('CANCELLED'));
 const payload=JSON.stringify({data,method,parameters});
 if(Buffer.byteLength(payload)>3*1024*1024)return Promise.reject(Error('INPUT_LIMIT'));
 return new Promise((resolve,reject)=>{
  const engine=engineManifest();
  const entry=path.join(__dirname,'worker-entry.js'),statistics=path.join(__dirname,'statistics.js');
  // Resource separation and defense in depth for OUR trusted code, not an OS sandbox.
  const child=spawn(process.execPath,['--permission',`--allow-fs-read=${entry}`,`--allow-fs-read=${statistics}`,'--max-old-space-size=64',entry],{
   cwd:__dirname,env:{SystemRoot:process.env.SystemRoot||'',WINDIR:process.env.WINDIR||''},windowsHide:true,stdio:['pipe','pipe','ignore']
  });
  const chunks=[];let size=0,done=false;
  const timer=setTimeout(()=>finish(Error('TIME_LIMIT')),timeoutMs);
  const cancel=()=>finish(Error('CANCELLED'));
  function finish(error,value){if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);child.kill();error?reject(error):resolve(value);}
  signal?.addEventListener('abort',cancel,{once:true});
  child.on('error',()=>finish(Error('RUNNER_UNAVAILABLE')));
  child.stdin.on('error',()=>finish(Error('RUNNER_FAILED')));
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>3*1024*1024)return finish(Error('OUTPUT_LIMIT'));chunks.push(chunk);});
  child.on('close',code=>{
   if(done)return;
   if(code!==0)return finish(Error('RUNNER_FAILED'));
   try{
    const output=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(output.schema!=='astha-result/1'||output.method!==method||!output.result||typeof output.runtime!=='string')throw Error();
    if(JSON.stringify(engine)!==JSON.stringify(engineManifest()))throw Error();
    finish(null,{...output,engine});
   }catch(_){finish(Error('INVALID_OUTPUT'));}
  });
  child.stdin.end(payload);
 });
}
module.exports={run};
