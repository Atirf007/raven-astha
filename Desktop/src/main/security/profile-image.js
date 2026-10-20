'use strict';
function validProfileImage(value){
  if(typeof value!=='string'||value.length>2_000_000)return false;
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match||match[2].length%4!==0)return false;
  const bytes=Buffer.from(match[2],'base64');if(bytes.length<12||bytes.toString('base64')!==match[2])return false;
  switch(match[1]){
    case 'png':return bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0&&bytes.readUInt32BE(16)<=12000&&bytes.readUInt32BE(20)<=12000;
    case 'jpeg':return bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))&&bytes.subarray(-2).equals(Buffer.from('ffd9','hex'));
    case 'webp':return bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(bytes.toString('ascii',12,16));
    default:return false;
  }
}
module.exports={validProfileImage};
