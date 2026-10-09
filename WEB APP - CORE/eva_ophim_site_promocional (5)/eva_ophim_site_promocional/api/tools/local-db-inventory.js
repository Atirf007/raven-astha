'use strict';
const mysql = require('../node_modules/mysql2/promise');
const secretInput = require('./secret-input');
async function main() {
  const {password} = await secretInput();
  if (typeof password !== 'string' || !password) throw Error('PASSWORD_REQUIRED');
  const db = await mysql.createConnection({host:'127.0.0.1',port:3306,user:'root',password,multipleStatements:false,flags:'-LOCAL_FILES',connectTimeout:5000});
  try {
    const [version] = await db.execute('SELECT VERSION() AS version');
    const [schemas] = await db.execute("SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('mysql','sys','performance_schema','information_schema')");
    const output = {version:version[0].version, databases:[]};
    for (const {name} of schemas) {
      const [tables] = await db.execute('SELECT TABLE_NAME AS name,TABLE_ROWS AS estimated_rows FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME',[name]);
      const entry={name,tables};
      if (/^[a-zA-Z0-9_]+$/.test(name) && tables.some(t=>t.name==='users')) {
        const [columns]=await db.execute("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users'",[name]);
        if (['email','role','org_id'].every(c=>columns.some(x=>x.name===c))) {
          const [users]=await db.execute('SELECT email,role,org_id FROM `'+name+'`.users WHERE email=?',['admin@astah.com']);entry.test_account=users;
        }
      }
      output.databases.push(entry);
    }
    console.log(JSON.stringify(output));
  } finally {await db.end();}
}
main().catch(error=>{console.error('INVENTORY_FAILED',error.code||'LOCAL_DB_ERROR');process.exitCode=1;});
