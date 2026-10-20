'use strict';
// Trusted, fixed runner. JSON data cannot select code, modules, paths or commands.
const {descriptive,kaplanMeier,weibull2p,gaussian,ageHazard,pareto}=require('./statistics');
let size=0;const chunks=[];
process.stdin.on('data',chunk=>{size+=chunk.length;if(size>3*1024*1024)process.exit(1);chunks.push(chunk);});
process.stdin.on('end',()=>{
 try{
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  let result;
  if(input.method==='descriptive/1')result=descriptive(input.data.rows.map(row=>row.value));
  else if(input.method==='normal-reference/1')result=gaussian(input.data.rows.map(row=>row.value));
  else if(input.method==='age-hazard/1')result=ageHazard(input.data.rows,input.parameters);
  else if(input.method==='pareto/1')result=pareto(input.data.rows,input.parameters);
  else if(input.method==='kaplan-meier-right/1')result=kaplanMeier(input.data.rows,input.parameters);
  else if(input.method==='weibull-2p-right/1')result=weibull2p(input.data.rows,input.parameters);
  else throw Error('Unsupported method');
  process.stdout.write(JSON.stringify({schema:'astha-result/1',method:input.method,runtime:process.version,result}));
 }catch(_){process.exitCode=1;}
});
