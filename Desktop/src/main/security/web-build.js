'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function fingerprint(root=path.resolve(__dirname,'..')){
 const files=[];
 function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile()&&['.js','.sql'].includes(path.extname(entry.name)))files.push(file);}}
 for(const directory of ['routes','middleware','security','services','database'])walk(path.join(root,directory));
 for(const entry of fs.readdirSync(root,{withFileTypes:true}))if(entry.isFile()&&path.extname(entry.name)==='.js')files.push(path.join(root,entry.name));
 const hash=createHash('sha256');for(const file of files.sort()){hash.update(path.relative(root,file).replaceAll('\\','/'));hash.update('\0');hash.update(fs.readFileSync(file));hash.update('\0');}return hash.digest('hex');
}
module.exports={fingerprint};
