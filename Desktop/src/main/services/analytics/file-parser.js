'use strict';
// Fixed, original parser. Production executes this source only inside the isolated container.
const {TextDecoder}=require('node:util');
const MAX_BYTES=2097152,MAX_ROWS=4000,MAX_COLUMNS=64;
function fail(){throw Error('INVALID_FILE');}
function cell(value){if(value===null||typeof value==='boolean')return value;if(typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e100)return value;if(typeof value==='string'&&value.length<=2048&&!/[\u0000]/.test(value))return value;fail();}
function columns(values){if(!values.length||values.length>MAX_COLUMNS)fail();const names=values.map(value=>{if(typeof value!=='string')fail();const name=value.trim();if(!name||name.length>100||/[\u0000-\u001f]/.test(name)||['__proto__','constructor','prototype'].includes(name))fail();return name;});if(new Set(names).size!==names.length)fail();return names;}
function csv(content,delimiter){
 if(![',',';','\t'].includes(delimiter))fail();
 const records=[];let row=[],value='',quoted=false,closed=false,started=false;
 function pushCell(){row.push(cell(value));if(row.length>MAX_COLUMNS)fail();value='';closed=false;started=false;}
 function pushRow(){pushCell();records.push(row);row=[];if(records.length>MAX_ROWS+1)fail();}
 for(let i=0;i<content.length;i++){
  const c=content[i];
  if(quoted){if(c==='"'){if(content[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;}
  else if(c===delimiter)pushCell();
  else if(c==='\r'||c==='\n'){if(c==='\r'&&content[i+1]==='\n')i++;pushRow();}
  else if(c==='"'){if(started||closed||value)fail();quoted=true;started=true;}
  else{if(closed)fail();value+=c;started=true;}
  if(value.length>2048)fail();
 }
 if(quoted)fail();if(row.length||started||closed||value)pushRow();
 if(records.length<2)fail();const names=columns(records.shift());if(records.some(record=>record.length!==names.length))fail();return {columns:names,rows:records};
}
function flatJson(content){
 // Parse the closed, flat profile directly: nested objects/arrays and duplicate decoded keys
 // are refused before JSON.parse can discard a repeated key or build a deep structure.
 let position=0,keys=null;const rows=[];
 const whitespace=()=>{while(/[\x20\t\r\n]/.test(content[position]||'\0'))position++;};
 function expect(character){whitespace();if(content[position++]!==character)fail();}
 function string(){
  whitespace();const start=position;if(content[position++]!=='"')fail();
  while(position<content.length){const character=content[position++];if(character==='"'){const result=JSON.parse(content.slice(start,position));if(result.length>2048)fail();return result;}if(character==='\\')position++;if(position-start>12290)fail();}fail();
 }
 function value(){
  whitespace();if(content[position]==='"')return cell(string());if(['{','['].includes(content[position]))fail();
  const start=position;while(position<content.length&&!/[\x20\t\r\n,}\]]/.test(content[position])){position++;if(position-start>2048)fail();}
  if(position===start)fail();return cell(JSON.parse(content.slice(start,position)));
 }
 expect('[');whitespace();if(content[position]===']')fail();
 while(true){
  expect('{');const entries=new Map();
  while(true){const key=string();if(entries.has(key)||entries.size>=MAX_COLUMNS)fail();expect(':');entries.set(key,value());whitespace();if(content[position]==='}'){position++;break;}expect(',');}
  const current=[...entries.keys()];if(!keys){keys=current;columns(keys);}else if(current.length!==keys.length||keys.some(key=>!entries.has(key)))fail();
  rows.push(keys.map(key=>entries.get(key)));if(rows.length>MAX_ROWS)fail();whitespace();if(content[position]===']'){position++;break;}expect(',');
 }
 whitespace();if(position!==content.length)fail();return {columns:columns(keys),rows};
}
function parseFile(input){
 if(!input||!['csv','json'].includes(input.format)||typeof input.content!=='string'||input.content.length>Math.ceil(MAX_BYTES/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.content))fail();
 const raw=Buffer.from(input.content,'base64');if(!raw.length||raw.length>MAX_BYTES)fail();
 const content=new TextDecoder('utf-8',{fatal:true}).decode(raw).replace(/^\uFEFF/,'');let table;
 if(input.format==='csv')table=csv(content,input.delimiter);
 else table=flatJson(content);
 return {schema:'astha-parsed-file/1',...table};
}
function readInput(){const timer=setTimeout(()=>process.exit(1),15000);timer.unref();let size=0;const chunks=[];process.stdin.on('data',chunk=>{size+=chunk.length;if(size>3*1024*1024)process.exit(1);chunks.push(chunk);});process.stdin.on('end',()=>{clearTimeout(timer);try{const table=parseFile(JSON.parse(Buffer.concat(chunks).toString('utf8')));process.stdout.write(JSON.stringify({runtime:process.version,table}));}catch(_){process.exitCode=1;}});}
if(require.main===module)readInput();
module.exports={parseFile,readInput};
