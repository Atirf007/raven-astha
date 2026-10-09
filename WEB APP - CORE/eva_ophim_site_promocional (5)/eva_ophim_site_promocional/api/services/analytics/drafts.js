'use strict';
const {fields,invalid}=require('./datasets');
function draft(value){
 fields(value,['kind','variable','unit','rows']);
 if(!['measurements','life','categories'].includes(value.kind)||typeof value.variable!=='string'||value.variable.length>100||typeof value.unit!=='string'||value.unit.length>24||!Array.isArray(value.rows)||value.rows.length>4000)invalid('Rascunho inválido ou acima dos limites.');
 const columns=value.kind==='measurements'?2:3;
 for(const row of value.rows){if(!Array.isArray(row)||row.length!==columns||row.some(cell=>typeof cell!=='string')||row[0].length>120||row[1].length>64||(columns===3&&(row[2].length>100||value.kind==='life'&&!['','true','false'].includes(row[2]))))invalid('Célula de rascunho inválida.');}
 const content=JSON.stringify(value);if(Buffer.byteLength(content)>2097152)invalid('Rascunho acima do limite de tamanho.');
 return content;
}
function version(value){if(!Number.isSafeInteger(value)||value<0||value>2147483646)invalid('Versão de rascunho inválida.');return value;}
module.exports={draft,version};
