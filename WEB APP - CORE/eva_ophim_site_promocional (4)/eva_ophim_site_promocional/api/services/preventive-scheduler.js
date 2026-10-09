const Calendar=require('../../app/js/maintenance-calendar');
const { pool } = require('../database/connection');

async function generateDuePreventives(orgId, actorId) {
  const connection = await pool.getConnection();
  const generated = [];
  try {
    await connection.beginTransaction();
    const [plans] = await connection.execute(
      "SELECT p.id,p.asset_id,p.title,p.interval_days,p.next_due_at,p.next_due_hours,p.next_due_cycles,p.priority,p.calendar_json,a.operating_hours,a.operating_cycles,CASE WHEN p.next_due_at<=CURDATE() THEN p.next_due_at ELSE CURDATE() END AS run_due_at FROM preventive_plans p JOIN assets a ON a.id=p.asset_id AND BINARY a.org_id=BINARY p.org_id WHERE p.org_id=? AND p.active=1 AND (p.next_due_at<=CURDATE() OR (p.next_due_hours IS NOT NULL AND a.operating_hours>=p.next_due_hours) OR (p.next_due_cycles IS NOT NULL AND a.operating_cycles>=p.next_due_cycles)) ORDER BY FIELD(p.priority,'urgent','high','medium','low'),p.next_due_at,p.id FOR UPDATE",
      [orgId]
    );
    const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()),today=local.slice(0,10),time=local.slice(11,16);
    for (const plan of plans) {
      const calendar=Calendar.parse(plan.calendar_json);
      if(calendar&&(!Calendar.working(today,calendar)||time<calendar.start||time>=calendar.end))continue;
      if(calendar)plan.run_due_at=Calendar.nextWorking(String(plan.run_due_at instanceof Date?plan.run_due_at.toISOString():plan.run_due_at).slice(0,10),calendar);
      if(calendar&&plan.run_due_at>today)continue;
      const [run] = await connection.execute(
        'INSERT IGNORE INTO preventive_plan_runs (org_id, plan_id, due_date) VALUES (?, ?, ?)',
        [orgId, plan.id, plan.run_due_at]
      );
      if (!run.affectedRows) {
        await connection.execute('UPDATE preventive_plans SET next_due_at=DATE_ADD(next_due_at,INTERVAL interval_days DAY),next_due_hours=IF(next_due_hours IS NULL,NULL,GREATEST(next_due_hours+interval_hours,?+interval_hours)),next_due_cycles=IF(next_due_cycles IS NULL,NULL,GREATEST(next_due_cycles+interval_cycles,?+interval_cycles)) WHERE id=? AND org_id=?',[plan.operating_hours,plan.operating_cycles,plan.id,orgId]);
        continue;
      }
      const [order] = await connection.execute(
        "INSERT INTO maintenance_work_orders (org_id, asset_id, title, type, priority, due_at, created_by) VALUES (?, ?, ?, 'preventive', ?, ?, ?)",
        [orgId, plan.asset_id, plan.title, plan.priority==='urgent'?'critical':plan.priority||'medium', plan.run_due_at, actorId]
      );
      const orderNumber=`OS-${String(order.insertId).padStart(8,'0')}`;
      await connection.execute('UPDATE maintenance_work_orders SET work_order_number=? WHERE id=? AND org_id=?',[orderNumber,order.insertId,orgId]);
      await connection.execute('INSERT INTO work_order_audit (org_id,work_order_id,action,detail,actor_id) VALUES (?,?,?,?,?)',[orgId,order.insertId,'preventive_generated',String(plan.id),actorId]);
      const [tasks]=await connection.execute('SELECT title FROM preventive_plan_tasks WHERE plan_id=? AND org_id=? ORDER BY position_order,id',[plan.id,orgId]);
      for(const task of tasks)await connection.execute('INSERT INTO work_order_tasks (org_id,work_order_id,title) VALUES (?,?,?)',[orgId,order.insertId,task.title]);
      const [spares]=await connection.execute('SELECT material_id,quantity FROM asset_spares WHERE asset_id=? AND org_id=?',[plan.asset_id,orgId]);
      for(const spare of spares){
        const quantity=Number(spare.quantity);
        const [materials]=await connection.execute('SELECT quantity FROM materials WHERE id=? AND org_id=? FOR UPDATE',[spare.material_id,orgId]);
        if(!materials.length)continue;
        const [reserved]=await connection.execute("SELECT COALESCE(SUM(quantity),0) AS quantity FROM inventory_reservations WHERE org_id=? AND material_id=? AND status='active'",[orgId,spare.material_id]);
        const available=Number(materials[0].quantity)-Number(reserved[0].quantity);
        if(available>=quantity){
          await connection.execute('INSERT INTO inventory_reservations (org_id,work_order_id,material_id,quantity,created_by) VALUES (?,?,?,?,?)',[orgId,order.insertId,spare.material_id,quantity,actorId]);
          await connection.execute('INSERT INTO work_order_audit (org_id,work_order_id,action,detail,actor_id) VALUES (?,?,?,?,?)',[orgId,order.insertId,'preventive_reserved',`${spare.material_id}:${quantity}`,actorId]);
        }else{
          if(available>0)await connection.execute('INSERT INTO inventory_reservations (org_id,work_order_id,material_id,quantity,created_by) VALUES (?,?,?,?,?)',[orgId,order.insertId,spare.material_id,Math.min(quantity,available),actorId]);
          const shortage=Math.max(0,quantity-Math.max(0,available));
          await connection.execute("INSERT INTO purchase_requisitions (org_id,work_order_id,material_id,requested_quantity,reason,created_by) VALUES (?,?,?,?, 'preventive_shortage', ?)",[orgId,order.insertId,spare.material_id,shortage,actorId]);
          await connection.execute('INSERT INTO work_order_audit (org_id,work_order_id,action,detail,actor_id) VALUES (?,?,?,?,?)',[orgId,order.insertId,'preventive_shortage',`${spare.material_id}:${shortage}`,actorId]);
        }
      }
      await connection.execute('UPDATE preventive_plan_runs SET work_order_id = ? WHERE plan_id = ? AND due_date = ? AND org_id=?', [order.insertId, plan.id, plan.run_due_at, orgId]);
      await connection.execute('UPDATE preventive_plans SET next_due_at=DATE_ADD(next_due_at,INTERVAL interval_days DAY),next_due_hours=IF(next_due_hours IS NULL,NULL,GREATEST(next_due_hours+interval_hours,?+interval_hours)),next_due_cycles=IF(next_due_cycles IS NULL,NULL,GREATEST(next_due_cycles+interval_cycles,?+interval_cycles)) WHERE id=? AND org_id=?',[plan.operating_hours,plan.operating_cycles,plan.id,orgId]);
      generated.push({ plan_id: plan.id, work_order_id: order.insertId });
    }
    await connection.commit();
    return generated;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

module.exports = { generateDuePreventives };
