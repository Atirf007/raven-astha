'use strict';
async function main(){
 const {password}=await require('./secret-input')();
 const db=await require('../node_modules/mysql2/promise').createConnection({host:'127.0.0.1',port:3306,user:'root',password,database:'astha_raven_lab',multipleStatements:false,flags:'-LOCAL_FILES'});
 try{
  const [marker]=await db.execute('SELECT component FROM astha_lab_installation');
  if(marker.length!==1||marker[0].component!=='local-web-laboratory')throw Error('SCHEMA_NOT_OWNED');
  await require('../database/warehouse-context').upgrade(db);
  await db.query("GRANT SELECT,INSERT,UPDATE,DELETE ON astha_raven_lab.warehouse_context TO 'astha_lab_web'@'127.0.0.1'");
  for(const table of ['warehouse_map_meta','movement_valuation'])await db.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON astha_raven_lab.${table} TO 'astha_lab_web'@'127.0.0.1'`);
  console.log('WAREHOUSE_CONTEXT_UPDATED');
 }finally{await db.end();}
}
main().catch(error=>{console.error('WAREHOUSE_UPGRADE_FAILED',error.code||error.message);process.exitCode=1;});
