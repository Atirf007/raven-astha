const express = require('express');
const { pool } = require('../database/connection');
const { requireRoles } = require('../security/authorization');

const router = express.Router();
const write = requireRoles('superadmin', 'admin', 'manager', 'operator');
const manage = requireRoles('superadmin', 'admin', 'manager');
const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const metric = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value);
const validLimit = value => value === null || (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000000000);

router.get('/assets/:assetId/condition', async (req, res) => {
  const assetId = positiveId(req.params.assetId);
  if (!assetId) return res.status(400).json({ error: 'Ativo inválido' });
  try {
    const [assets] = await pool.execute('SELECT id FROM assets WHERE id=? AND org_id=?', [assetId, req.user.org_id]);
    if (!assets.length) return res.status(404).json({ error: 'Ativo não encontrado' });
    const [rules] = await pool.execute('SELECT id,metric_code,unit,minimum_value,maximum_value,severity,is_active FROM condition_rules WHERE asset_id=? AND org_id=? ORDER BY metric_code,id', [assetId, req.user.org_id]);
    const [readings] = await pool.execute('SELECT id,metric_code,value,unit,recorded_at,source FROM condition_readings WHERE asset_id=? AND org_id=? ORDER BY recorded_at DESC,id DESC LIMIT 100', [assetId, req.user.org_id]);
    const [alerts] = await pool.execute('SELECT a.id,a.status,a.severity,a.work_order_id,a.created_at,a.acknowledged_at,a.closed_at,r.metric_code,r.value,r.unit FROM condition_alerts a JOIN condition_readings r ON r.id=a.reading_id AND BINARY r.org_id=BINARY a.org_id WHERE a.asset_id=? AND a.org_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT 100', [assetId, req.user.org_id]);
    res.json({ rules, readings, alerts });
  } catch (_) { res.status(500).json({ error: 'Erro ao carregar monitoramento' }); }
});

router.post('/assets/:assetId/condition/rules', manage, async (req, res) => {
  const assetId = positiveId(req.params.assetId), b = req.body || {};
  const minimum = b.minimum_value ?? null, maximum = b.maximum_value ?? null;
  if (!assetId || !metric(b.metric_code) || typeof b.unit !== 'string' || b.unit.length > 30 || !validLimit(minimum) || !validLimit(maximum) || (minimum === null && maximum === null) || (minimum !== null && maximum !== null && minimum >= maximum) || !['warning', 'critical'].includes(b.severity)) return res.status(400).json({ error: 'Regra de condição inválida' });
  try {
    const [assets] = await pool.execute('SELECT id FROM assets WHERE id=? AND org_id=?', [assetId, req.user.org_id]);
    if (!assets.length) return res.status(404).json({ error: 'Ativo não encontrado' });
    const [created] = await pool.execute('INSERT INTO condition_rules (org_id,asset_id,metric_code,unit,minimum_value,maximum_value,severity,created_by) VALUES (?,?,?,?,?,?,?,?)', [req.user.org_id, assetId, b.metric_code, b.unit.trim() || null, minimum, maximum, b.severity, req.user.id]);
    res.status(201).json({ id: created.insertId, asset_id: assetId });
  } catch (_) { res.status(500).json({ error: 'Erro ao salvar regra de condição' }); }
});

router.patch('/assets/:assetId/condition/rules/:ruleId', manage, async (req, res) => {
  const assetId = positiveId(req.params.assetId), ruleId = positiveId(req.params.ruleId), active = req.body?.is_active;
  if (!assetId || !ruleId || typeof active !== 'boolean') return res.status(400).json({ error: 'Atualização inválida' });
  try {
    const [updated] = await pool.execute('UPDATE condition_rules SET is_active=? WHERE id=? AND asset_id=? AND org_id=?', [active ? 1 : 0, ruleId, assetId, req.user.org_id]);
    if (!updated.affectedRows) return res.status(404).json({ error: 'Regra não encontrada' });
    res.json({ id: ruleId, is_active: active });
  } catch (_) { res.status(500).json({ error: 'Erro ao atualizar regra' }); }
});

router.post('/assets/:assetId/condition/readings', write, async (req, res) => {
  const assetId = positiveId(req.params.assetId), b = req.body || {};
  if (!assetId || !metric(b.metric_code) || typeof b.value !== 'number' || !Number.isFinite(b.value) || Math.abs(b.value) > 1000000000 || typeof b.unit !== 'string' || b.unit.length > 30 || !['manual', 'inspection'].includes(b.source)) return res.status(400).json({ error: 'Leitura de condição inválida' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [assets] = await connection.execute('SELECT id FROM assets WHERE id=? AND org_id=? FOR UPDATE', [assetId, req.user.org_id]);
    if (!assets.length) { await connection.rollback(); return res.status(404).json({ error: 'Ativo não encontrado' }); }
    const [rules] = await connection.execute('SELECT id,minimum_value,maximum_value,severity,unit FROM condition_rules WHERE asset_id=? AND org_id=? AND metric_code=? AND is_active=1', [assetId, req.user.org_id, b.metric_code]);
    if (rules.some(rule => rule.unit && rule.unit !== b.unit.trim())) { await connection.rollback(); return res.status(409).json({ error: 'Unidade incompatível com a regra' }); }
    const [created] = await connection.execute('INSERT INTO condition_readings (org_id,asset_id,metric_code,value,unit,recorded_at,source,created_by) VALUES (?,?,?,?,?,NOW(),?,?)', [req.user.org_id, assetId, b.metric_code, b.value, b.unit.trim() || null, b.source, req.user.id]);
    const alerts = [];
    for (const rule of rules) {
      if ((rule.minimum_value !== null && b.value < Number(rule.minimum_value)) || (rule.maximum_value !== null && b.value > Number(rule.maximum_value))) {
        const [alert] = await connection.execute('INSERT INTO condition_alerts (org_id,asset_id,rule_id,reading_id,severity) VALUES (?,?,?,?,?)', [req.user.org_id, assetId, rule.id, created.insertId, rule.severity]);
        alerts.push(alert.insertId);
      }
    }
    await connection.commit();
    res.status(201).json({ id: created.insertId, alert_ids: alerts });
  } catch (_) { await connection.rollback(); res.status(500).json({ error: 'Erro ao registrar leitura' }); }
  finally { connection.release(); }
});

router.post('/assets/:assetId/condition/alerts/:alertId/work-order', manage, async (req, res) => {
  const assetId = positiveId(req.params.assetId), alertId = positiveId(req.params.alertId);
  if (!assetId || !alertId) return res.status(400).json({ error: 'Alerta inválido' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [alerts] = await connection.execute('SELECT a.status,a.severity,a.work_order_id,r.metric_code,r.value,r.unit FROM condition_alerts a JOIN condition_readings r ON r.id=a.reading_id AND BINARY r.org_id=BINARY a.org_id WHERE a.id=? AND a.asset_id=? AND a.org_id=? FOR UPDATE', [alertId, assetId, req.user.org_id]);
    if (!alerts.length) { await connection.rollback();return res.status(404).json({ error: 'Alerta não encontrado' }); }
    const alert = alerts[0];
    if (alert.status === 'closed' || alert.work_order_id) { await connection.rollback();return res.status(409).json({ error: 'Alerta encerrado ou já vinculado a uma ordem' }); }
    const title = `Condição fora do limite: ${alert.metric_code}`;
    const description = `Alerta CBM #${alertId}: leitura ${alert.value} ${alert.unit || ''}`;
    const priority = alert.severity === 'critical' ? 'critical' : 'high';
    const [created] = await connection.execute('INSERT INTO maintenance_work_orders (org_id,asset_id,title,description,type,priority,created_by) VALUES (?,?,?,?,?,?,?)', [req.user.org_id, assetId, title, description, 'corrective', priority, req.user.id]);
    const number = `OS-${String(created.insertId).padStart(8, '0')}`;
    await connection.execute('UPDATE maintenance_work_orders SET work_order_number=? WHERE id=? AND org_id=?', [number, created.insertId, req.user.org_id]);
    await connection.execute('UPDATE condition_alerts SET work_order_id=? WHERE id=? AND asset_id=? AND org_id=?', [created.insertId, alertId, assetId, req.user.org_id]);
    await connection.execute('INSERT INTO work_order_audit (org_id,work_order_id,action,detail,actor_id) VALUES (?,?,?,?,?)', [req.user.org_id, created.insertId, 'created_from_condition_alert', String(alertId), req.user.id]);
    await connection.commit();res.status(201).json({ id: created.insertId, work_order_number: number, alert_id: alertId });
  } catch (_) { await connection.rollback();res.status(500).json({ error: 'Erro ao criar ordem de condição' }); }
  finally { connection.release(); }
});

router.patch('/assets/:assetId/condition/alerts/:alertId', manage, async (req, res) => {
  const assetId = positiveId(req.params.assetId), alertId = positiveId(req.params.alertId), status = req.body?.status;
  if (!assetId || !alertId || !['acknowledged', 'closed'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [alerts] = await connection.execute('SELECT status FROM condition_alerts WHERE id=? AND asset_id=? AND org_id=? FOR UPDATE', [alertId, assetId, req.user.org_id]);
    if (!alerts.length) { await connection.rollback(); return res.status(404).json({ error: 'Alerta não encontrado' }); }
    if ((status === 'acknowledged' && alerts[0].status !== 'open') || (status === 'closed' && alerts[0].status !== 'acknowledged')) { await connection.rollback(); return res.status(409).json({ error: 'Transição de alerta inválida' }); }
    await connection.execute("UPDATE condition_alerts SET status=?,acknowledged_by=CASE WHEN ?='acknowledged' THEN ? ELSE acknowledged_by END,acknowledged_at=CASE WHEN ?='acknowledged' THEN NOW() ELSE acknowledged_at END,closed_by=CASE WHEN ?='closed' THEN ? ELSE closed_by END,closed_at=CASE WHEN ?='closed' THEN NOW() ELSE closed_at END WHERE id=? AND asset_id=? AND org_id=?", [status, status, req.user.id, status, status, req.user.id, status, alertId, assetId, req.user.org_id]);
    await connection.commit();
    res.json({ id: alertId, status });
  } catch (_) { await connection.rollback(); res.status(500).json({ error: 'Erro ao atualizar alerta' }); }
  finally { connection.release(); }
});

module.exports = router;
