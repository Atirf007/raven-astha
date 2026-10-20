'use strict';
const {randomUUID}=require('node:crypto');
const {restore}=require('./datasets');
const {run}=require('./runner');
function createProcessor(pool,execute=run){
 let busy=false,stopped=false,activeController=null;
 async function tick(){
  if(busy||stopped)return;busy=true;let job,token;
  try{
   for(let claimAttempt=0;claimAttempt<3;claimAttempt++){
   const connection=await pool.getConnection();
   try{
    await connection.beginTransaction();
    await connection.execute("UPDATE analytics_jobs SET status='failed',error_code='ATTEMPTS_EXHAUSTED',completed_at=NOW(3) WHERE status='running' AND lease_expires_at<NOW(3) AND attempts>=3");
    const [rows]=await connection.execute("SELECT j.*,s.dataset,s.content_hash,u.is_active,u.role,st.created_by AS study_owner FROM analytics_jobs j JOIN analytics_snapshots s ON s.id=j.snapshot_id AND BINARY s.org_id=BINARY j.org_id AND s.study_id=j.study_id JOIN analytics_studies st ON st.id=j.study_id AND BINARY st.org_id=BINARY j.org_id LEFT JOIN users u ON u.id=j.created_by AND BINARY u.org_id=BINARY j.org_id WHERE (j.status='queued' OR (j.status='running' AND j.lease_expires_at<NOW(3) AND j.attempts<3)) ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE OF j");
    job=rows[0];
    if(job){
     if(!job.is_active||!['admin','superadmin','manager'].includes(job.role)||(job.role==='manager'&&Number(job.study_owner)!==Number(job.created_by))){
      await connection.execute("UPDATE analytics_jobs SET status='failed',error_code='ACCESS_REVOKED',completed_at=NOW(3) WHERE id=? AND org_id=?",[job.id,job.org_id]);job=null;
     }else{
      token=randomUUID();await connection.execute("UPDATE analytics_jobs SET status='running',attempts=attempts+1,lease_token=?,lease_expires_at=DATE_ADD(NOW(3),INTERVAL 45 SECOND),error_code=NULL WHERE id=? AND org_id=?",[token,job.id,job.org_id]);
     }
    }
    await connection.commit();break;
   }catch(error){await connection.rollback();job=null;token=null;if(!['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)||claimAttempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,30*(claimAttempt+1)+Math.floor(Math.random()*30)));}finally{connection.release();}
   }
   if(!job||stopped)return;
   let monitor,controller=new AbortController();
   activeController=controller;
   try{
    const stored=typeof job.dataset==='string'?JSON.parse(job.dataset):job.dataset;
    const snapshot=restore(stored);
    if(snapshot.hash!==job.content_hash)throw Error('SNAPSHOT_INTEGRITY');
    const parameters=typeof job.parameters==='string'?JSON.parse(job.parameters):job.parameters;
    let checking=false;
    monitor=setInterval(async()=>{
     if(checking)return;checking=true;
     try{
      const [valid]=await pool.execute("SELECT j.id FROM analytics_jobs j JOIN users u ON u.id=j.created_by AND BINARY u.org_id=BINARY j.org_id JOIN analytics_studies st ON st.id=j.study_id AND BINARY st.org_id=BINARY j.org_id WHERE j.id=? AND j.org_id=? AND j.status='running' AND j.lease_token=? AND j.lease_expires_at>NOW(3) AND u.is_active=1 AND (u.role IN ('superadmin','admin') OR (u.role='manager' AND st.created_by=u.id))",[job.id,job.org_id,token]);
      if(!valid.length)controller.abort();
     }catch(_){controller.abort();}finally{checking=false;}
    },1000);
    const output=await execute(snapshot.data,job.method,parameters,{signal:controller.signal});
    if(controller.signal.aborted||stopped)throw Error('CANCELLED');
    const result={...output,snapshot_hash:snapshot.hash,snapshot_id:job.snapshot_id,variable:snapshot.data.variable,source:snapshot.data.source,parameters};
    await pool.execute("UPDATE analytics_jobs j JOIN users u ON u.id=j.created_by AND BINARY u.org_id=BINARY j.org_id JOIN analytics_studies st ON st.id=j.study_id AND BINARY st.org_id=BINARY j.org_id SET j.status='completed',j.result=?,j.completed_at=NOW(3) WHERE j.id=? AND j.org_id=? AND j.status='running' AND j.lease_token=? AND j.lease_expires_at>NOW(3) AND u.is_active=1 AND (u.role IN ('superadmin','admin') OR (u.role='manager' AND st.created_by=u.id))",[JSON.stringify(result),job.id,job.org_id,token]);
   }catch(error){
    const code=['SNAPSHOT_INTEGRITY','TIME_LIMIT','CANCELLED','OUTPUT_LIMIT','INVALID_OUTPUT','RUNNER_UNAVAILABLE','INPUT_LIMIT'].includes(error.message)?error.message:'RUNNER_FAILED';
    await pool.execute("UPDATE analytics_jobs SET status='failed',error_code=?,completed_at=NOW(3) WHERE id=? AND org_id=? AND status='running' AND lease_token=?",[code,job.id,job.org_id,token]);
   }finally{clearInterval(monitor);controller.abort();activeController=null;}
  }finally{busy=false;}
 }
 function start(){const timer=setInterval(()=>tick().catch(()=>{}),3000);timer.unref();tick().catch(()=>{});return()=>{stopped=true;clearInterval(timer);activeController?.abort();};}
 return {tick,start};
}
module.exports={createProcessor};
