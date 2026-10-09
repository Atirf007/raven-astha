'use strict';
// A separate, disposable MySQL process. Never reads api/.env or connects to the app's database.
const fs=require('node:fs/promises'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process'),{randomBytes}=require('node:crypto');
const mysql=require('../../api/node_modules/mysql2/promise');
const root=path.resolve(__dirname,'../..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function vacantPort(){const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
function command(exe,args,input=''){return new Promise((resolve,reject)=>{const child=spawn(exe,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',data=>{if(output.length<4000)output+=data;});child.stderr.on('data',()=>{});const timer=setTimeout(()=>{child.kill();reject(Error('SANDBOX_COMMAND_TIMEOUT'));},60000);child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(Object.assign(new Error('SANDBOX_COMMAND_FAILED'),{code}));});child.stdin.end(input);});}
async function removeOwnedWorkspace(workspace){const runtime=await fs.realpath(path.join(root,'tests','.runtime')),resolved=await fs.realpath(workspace);if(path.dirname(resolved)!==runtime||!path.basename(resolved).startsWith('mysql-'))throw Error('SANDBOX_CLEANUP_PATH_REJECTED');await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
async function startSandbox(){
 const bin=process.env.ASTHA_TEST_MYSQL_BIN||'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin';
 const mysqld=path.join(bin,'mysqld.exe'),cli=path.join(bin,'mysql.exe');await fs.access(mysqld);await fs.access(cli);
 const workspace=await fs.mkdtemp(path.join(await fs.mkdir(path.join(root,'tests','.runtime'),{recursive:true}).then(()=>path.join(root,'tests','.runtime')),'mysql-'));
 const data=path.join(workspace,'data'),log=path.join(workspace,'mysql.log'),pipe='ASTHA_TEST_'+randomBytes(8).toString('hex');
 const password=randomBytes(36).toString('hex'),db='astha_test_'+randomBytes(8).toString('hex'),port=await vacantPort();
 const base=['--no-defaults','--basedir='+path.dirname(bin),'--datadir='+data,'--log-error='+log,'--mysqlx=0','--skip-log-bin'];
 let processHandle=null,admin=null,pool=null;
 async function launch(args){processHandle=spawn(mysqld,[...base,...args],{windowsHide:true,stdio:'ignore'});processHandle.on('error',()=>{});}
 async function pipeCommand(sql){return command(cli,['--no-defaults','--protocol=PIPE','--socket='+pipe,'--user=root','--batch','--skip-column-names'],sql);}
 try{
  await command(mysqld,[...base,'--initialize-insecure']);
  await launch(['--skip-networking','--named-pipe=ON','--socket='+pipe]);
  let ready=false;for(let n=0;n<100;n++){try{await pipeCommand('SELECT 1;');ready=true;break;}catch(_){if(processHandle.exitCode!==null)break;await delay(200);}}
  if(!ready)throw Error('SANDBOX_BOOTSTRAP_UNAVAILABLE');
  // Credentials go through stdin, never command arguments, a file, logs or test reports.
  await pipeCommand("CREATE DATABASE "+db+" CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nCREATE USER 'astha_bootstrap'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY '"+password+"';\nGRANT ALL PRIVILEGES ON "+db+".* TO 'astha_bootstrap'@'127.0.0.1' WITH GRANT OPTION;\nGRANT SHUTDOWN ON *.* TO 'astha_bootstrap'@'127.0.0.1';\nCREATE USER 'astha_test'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY '"+password+"';\nGRANT SELECT,INSERT,UPDATE,DELETE ON "+db+".* TO 'astha_test'@'127.0.0.1';\nALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '"+password+"';\nSHUTDOWN;");
  if(processHandle.exitCode===null)await new Promise(resolve=>processHandle.once('exit',resolve));
  await launch(['--bind-address=127.0.0.1','--port='+port,'--skip-name-resolve']);
  let connected=false,lastCode;for(let n=0;n<100;n++){try{admin=await mysql.createConnection({host:'127.0.0.1',port,user:'astha_bootstrap',password,database:db,multipleStatements:false,connectTimeout:1000});connected=true;break;}catch(error){lastCode=error.code;if(processHandle.exitCode!==null)break;await delay(200);}}
  if(!connected)throw Error('SANDBOX_TCP_UNAVAILABLE:'+lastCode);
  // Only trusted CREATE TABLE statements from the existing schema; never DROP/USE or seed production accounts.
  const schema=await fs.readFile(path.join(root,'database/schema.sql'),'utf8');
  for(const sql of schema.match(/CREATE TABLE\b[\s\S]*?\) ENGINE=InnoDB[^;]*;/g)||[])await admin.query(sql);
  for(const [table,column,definition] of [['materials','org_id','VARCHAR(50)'],['materials','warehouse_id','INT NULL'],['movements','org_id','VARCHAR(50)']])await admin.query('ALTER TABLE '+table+' ADD COLUMN '+column+' '+definition);
  Object.assign(process.env,{DB_HOST:'127.0.0.1',DB_PORT:String(port),DB_USER:'astha_bootstrap',DB_PASSWORD:password,DB_NAME:db,DB_SSL_REQUIRED:'false',JWT_SECRET:randomBytes(48).toString('hex'),ANALYTICS_TRUSTED_RUNNER:'true',ANALYTICS_FILE_IMPORTS:'false'});
  // These environment values are set before importing modules; dotenv never overrides them.
  pool=require('../../api/database/connection').pool;
  await require('../../api/database/migrate_eam').runEamMigration();
  const analyticsSchema=await fs.readFile(path.join(root,'api/database/analytics_schema.sql'),'utf8');
  for(const sql of analyticsSchema.match(/CREATE TABLE\b[\s\S]*?;/g)||[])await admin.query(sql);
  // Runtime has no DDL rights and cannot mutate immutable analytical data.
  await admin.query('REVOKE ALL PRIVILEGES ON '+db+".* FROM 'astha_test'@'127.0.0.1'");
  const [tables]=await admin.query('SHOW TABLES');
  for(const row of tables){const table=Object.values(row)[0];if(!/^[a-z_]+$/.test(table))throw Error('UNEXPECTED_TABLE');const permissions=table==='organizations'?'SELECT,INSERT,UPDATE':['analytics_studies','analytics_snapshots','analytics_reviews','analytics_source_publications','asset_observations'].includes(table)?'SELECT,INSERT':table==='analytics_drafts'?'SELECT,INSERT,UPDATE':'SELECT,INSERT,UPDATE,DELETE';await admin.query('GRANT '+permissions+' ON '+db+'.'+table+" TO 'astha_test'@'127.0.0.1'");}
  await pool.end();process.env.DB_USER='astha_test';
  // Replace the now-closed bootstrap pool before loading any route or authentication middleware.
  pool=mysql.createPool({host:'127.0.0.1',port,user:'astha_test',password,database:db,multipleStatements:false,flags:'-LOCAL_FILES',connectionLimit:8,queueLimit:100});
  const connectionModule=require('../../api/database/connection');connectionModule.pool=pool;connectionModule.readWithRetry=(sql,params)=>pool.execute(sql,params);
  let lastFailure=null;const track=target=>{const original=target.execute.bind(target);target.execute=async(sql,params)=>{try{return await original(sql,params);}catch(error){lastFailure={code:error.code,operation:sql.split(/\s+/).slice(0,4).join(' ')};throw error;}};};track(pool);const acquire=pool.getConnection.bind(pool);pool.getConnection=async()=>{const item=await acquire();if(!item.testTracked){track(item);item.testTracked=true;}return item;};
  return{pool,admin,db,workspace,port,lastFailure:()=>lastFailure,async close(){await pool.end();try{await admin.query('SHUTDOWN');}catch(_){}await admin.end().catch(()=>{});if(processHandle.exitCode===null){await Promise.race([new Promise(resolve=>processHandle.once('exit',resolve)),delay(5000)]);if(processHandle.exitCode===null){processHandle.kill();await new Promise(resolve=>processHandle.once('exit',resolve));}}await removeOwnedWorkspace(workspace);}};
 }catch(error){await pool?.end().catch(()=>{});await admin?.query('SHUTDOWN').catch(()=>{});await admin?.end().catch(()=>{});if(processHandle&&processHandle.exitCode===null){await Promise.race([new Promise(resolve=>processHandle.once('exit',resolve)),delay(5000)]);if(processHandle.exitCode===null)processHandle.kill();}if(!processHandle||processHandle.exitCode!==null)await removeOwnedWorkspace(workspace);throw error;}
}
module.exports={startSandbox,root};
if(require.main===module)startSandbox().then(async sandbox=>{console.log('ISOLATED_MYSQL_READY');await sandbox.close();console.log('ISOLATED_MYSQL_STOPPED');}).catch(error=>{console.error('ISOLATED_MYSQL_FAILED:'+error.message);process.exitCode=1;});
