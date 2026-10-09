'use strict';
async function main(){const {password}=await require('./secret-input')();const db=await require('../node_modules/mysql2/promise').createConnection({host:'127.0.0.1',port:3306,user:'root',password,database:'astha_raven_lab',multipleStatements:false,flags:'-LOCAL_FILES'});try{await require('../database/local-web-schema').upgrade(db);console.log('LOCAL_SCHEMA_UPDATED');}finally{await db.end();}}
main().catch(error=>{console.error('UPGRADE_FAILED',error.code||error.message);process.exitCode=1;});
