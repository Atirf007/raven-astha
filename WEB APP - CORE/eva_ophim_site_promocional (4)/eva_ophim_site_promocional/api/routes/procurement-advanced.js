const { purchaseSnapshot } = require('../services/purchase-units');
const express = require('express');
const { pool } = require('../database/connection');
const { requireRoles } = require('../security/authorization');

const router = express.Router();
const write = requireRoles('superadmin', 'admin', 'manager');
const id = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

router.get('/qualifications', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT q.*,s.name AS supplier_name FROM supplier_qualifications q JOIN suppliers s ON s.id=q.supplier_id AND (BINARY s.org_id=BINARY q.org_id OR s.org_id IS NULL) WHERE q.org_id=? ORDER BY s.name,q.category', [req.user.org_id]);
    res.json(rows);
  } catch (_) { res.status(500).json({ error: 'Erro ao listar qualificações' }); }
});
router.post('/qualifications', write, async (req, res) => {
  const body = req.body || {}, supplierId = id(body.supplier_id), category = body.category, status = body.status, score = body.score, expires = body.expires_at;
  if (!supplierId || !text(category, 100) || !['pending', 'qualified', 'suspended', 'expired'].includes(status) || (score !== undefined && (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100)) || (expires !== undefined && expires !== null && !date(expires)) || (body.evidence_note !== undefined && body.evidence_note !== null && (typeof body.evidence_note !== 'string' || body.evidence_note.length > 500))) return res.status(400).json({ error: 'Qualificação inválida' });
  try {
    const [suppliers] = await pool.execute('SELECT id FROM suppliers WHERE id=? AND (org_id=? OR org_id IS NULL) AND is_active=1', [supplierId, req.user.org_id]);
    if (!suppliers.length) return res.status(404).json({ error: 'Fornecedor não encontrado' });
    await pool.execute('INSERT INTO supplier_qualifications (org_id,supplier_id,category,status,score,expires_at,evidence_note,approved_by,created_by) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),score=VALUES(score),expires_at=VALUES(expires_at),evidence_note=VALUES(evidence_note),approved_by=VALUES(approved_by)', [req.user.org_id, supplierId, category.trim(), status, score ?? null, expires || null, body.evidence_note?.trim() || null, status === 'qualified' ? req.user.id : null, req.user.id]);
    await pool.execute('INSERT INTO procurement_audit (org_id,entity_type,entity_id,action,detail,actor_id) VALUES (?,?,?,?,?,?)', [req.user.org_id, 'supplier', supplierId, 'qualification_updated', `${category.trim()}:${status}`, req.user.id]);
    res.json({ supplier_id: supplierId, category: category.trim(), status });
  } catch (_) { res.status(500).json({ error: 'Erro ao salvar qualificação' }); }
});

router.get('/rfqs', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT r.id,r.rfq_number,r.title,r.status,r.closes_at,r.created_at,COUNT(DISTINCT l.id) AS line_count,COUNT(DISTINCT b.id) AS bid_count FROM request_for_quotes r LEFT JOIN rfq_lines l ON l.rfq_id=r.id AND l.org_id=r.org_id LEFT JOIN rfq_bids b ON b.rfq_line_id=l.id AND b.org_id=r.org_id WHERE r.org_id=? GROUP BY r.id,r.rfq_number,r.title,r.status,r.closes_at,r.created_at ORDER BY r.created_at DESC LIMIT 200', [req.user.org_id]);
    res.json(rows);
  } catch (_) { res.status(500).json({ error: 'Erro ao listar RFQs' }); }
});
router.get('/rfqs/:id', async (req, res) => {
  const rfqId = id(req.params.id); if (!rfqId) return res.status(400).json({ error: 'RFQ inválida' });
  try {
    const [rfqs] = await pool.execute('SELECT * FROM request_for_quotes WHERE id=? AND org_id=?', [rfqId, req.user.org_id]);
    if (!rfqs.length) return res.status(404).json({ error: 'RFQ não encontrada' });
    const [lines] = await pool.execute('SELECT l.*,m.code,m.description FROM rfq_lines l JOIN materials m ON m.id=l.material_id AND BINARY m.org_id=BINARY l.org_id WHERE l.rfq_id=? AND l.org_id=? ORDER BY l.id', [rfqId, req.user.org_id]);
    const [bids] = await pool.execute('SELECT b.*,s.name AS supplier_name FROM rfq_bids b JOIN rfq_lines l ON l.id=b.rfq_line_id AND l.org_id=b.org_id JOIN suppliers s ON s.id=b.supplier_id AND (BINARY s.org_id=BINARY b.org_id OR s.org_id IS NULL) WHERE l.rfq_id=? AND b.org_id=? ORDER BY b.rfq_line_id,b.unit_price,b.id', [rfqId, req.user.org_id]);
    res.json({ rfq: rfqs[0], lines, bids });
  } catch (_) { res.status(500).json({ error: 'Erro ao consultar RFQ' }); }
});
router.post('/rfqs', write, async (req, res) => {
  const body = req.body || {}, lines = body.lines, title = body.title;
  if (!text(title, 200) || !Array.isArray(lines) || lines.length < 1 || lines.length > 50 || (body.closes_at != null && !date(body.closes_at)) || lines.some(line => !id(line?.material_id) || typeof line.quantity !== 'number' || !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 1000000 || (line.required_at != null && !date(line.required_at))) || new Set(lines.map(line => Number(line.material_id))).size !== lines.length) return res.status(400).json({ error: 'RFQ ou itens inválidos' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const line of lines) { const [materials] = await connection.execute('SELECT id FROM materials WHERE id=? AND org_id=? AND is_active=1', [line.material_id, req.user.org_id]); if (!materials.length) { await connection.rollback(); return res.status(404).json({ error: 'Material da RFQ não encontrado' }); } }
    const [created] = await connection.execute('INSERT INTO request_for_quotes (org_id,rfq_number,title,closes_at,created_by) VALUES (?,?,?,?,?)', [req.user.org_id, `PENDING-${Date.now()}-${req.user.id}`, title.trim(), body.closes_at ? `${body.closes_at} 23:59:59` : null, req.user.id]);
    const number = `RFQ-${String(created.insertId).padStart(8, '0')}`;
    await connection.execute('UPDATE request_for_quotes SET rfq_number=? WHERE id=? AND org_id=?', [number, created.insertId, req.user.org_id]);
    for (const line of lines) await connection.execute('INSERT INTO rfq_lines (org_id,rfq_id,material_id,quantity,required_at) VALUES (?,?,?,?,?)', [req.user.org_id, created.insertId, line.material_id, line.quantity, line.required_at || null]);
    await connection.execute('INSERT INTO procurement_audit (org_id,entity_type,entity_id,action,actor_id) VALUES (?,?,?,?,?)', [req.user.org_id, 'rfq', created.insertId, 'created', req.user.id]);
    await connection.commit();res.status(201).json({ id: created.insertId, rfq_number: number });
  } catch (_) { await connection.rollback();res.status(500).json({ error: 'Erro ao criar RFQ' }); } finally { connection.release(); }
});
router.patch('/rfqs/:id/status', write, async (req, res) => {
  const rfqId = id(req.params.id), status = req.body?.status;
  if (!rfqId || !['published', 'closed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Estado da RFQ inválido' });
  try {
    const [rows] = await pool.execute('SELECT status FROM request_for_quotes WHERE id=? AND org_id=?', [rfqId, req.user.org_id]);
    if (!rows.length) return res.status(404).json({ error: 'RFQ não encontrada' });
    const transitions = { draft: ['published', 'cancelled'], published: ['closed', 'cancelled'], closed: [], awarded: [], cancelled: [] };
    if (!transitions[rows[0].status]?.includes(status)) return res.status(409).json({ error: 'Transição de RFQ inválida' });
    await pool.execute('UPDATE request_for_quotes SET status=? WHERE id=? AND org_id=?', [status, rfqId, req.user.org_id]);
    await pool.execute('INSERT INTO procurement_audit (org_id,entity_type,entity_id,action,detail,actor_id) VALUES (?,?,?,?,?,?)', [req.user.org_id, 'rfq', rfqId, 'status_changed', `${rows[0].status}->${status}`, req.user.id]);
    res.json({ id: rfqId, status });
  } catch (_) { res.status(500).json({ error: 'Erro ao atualizar RFQ' }); }
});
router.post('/rfqs/:id/bids', write, async (req, res) => {
  const rfqId = id(req.params.id), lineId = id(req.body?.rfq_line_id), supplierId = id(req.body?.supplier_id), price = req.body?.unit_price, lead = req.body?.lead_time_days, currency = req.body?.currency || 'BRL';
  if (!rfqId || !lineId || !supplierId || typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 100000000 || !/^[A-Z]{3}$/.test(currency) || (lead != null && (!Number.isSafeInteger(lead) || lead < 0 || lead > 3650))) return res.status(400).json({ error: 'Proposta inválida' });
  try {
    const [rfqs] = await pool.execute("SELECT l.id FROM rfq_lines l JOIN request_for_quotes r ON r.id=l.rfq_id AND r.org_id=l.org_id WHERE l.id=? AND l.rfq_id=? AND l.org_id=? AND r.status='published' AND (r.closes_at IS NULL OR r.closes_at>=NOW())", [lineId, rfqId, req.user.org_id]);
    if (!rfqs.length) return res.status(409).json({ error: 'RFQ não disponível para propostas' });
    const [qualified] = await pool.execute("SELECT q.id FROM supplier_qualifications q JOIN suppliers s ON s.id=q.supplier_id AND (BINARY s.org_id=BINARY q.org_id OR s.org_id IS NULL) WHERE q.supplier_id=? AND q.org_id=? AND q.category='MRO' AND q.status='qualified' AND (q.expires_at IS NULL OR q.expires_at>=CURRENT_DATE) AND s.is_active=1", [supplierId, req.user.org_id]);
    if (!qualified.length) return res.status(409).json({ error: 'Fornecedor sem qualificação MRO válida' });
    await pool.execute('INSERT INTO rfq_bids (org_id,rfq_line_id,supplier_id,unit_price,currency,lead_time_days,created_by) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE unit_price=VALUES(unit_price),currency=VALUES(currency),lead_time_days=VALUES(lead_time_days),created_by=VALUES(created_by)', [req.user.org_id, lineId, supplierId, price, currency, lead ?? null, req.user.id]);
    await pool.execute('INSERT INTO procurement_audit (org_id,entity_type,entity_id,action,detail,actor_id) VALUES (?,?,?,?,?,?)', [req.user.org_id, 'rfq', rfqId, 'bid_recorded', `line:${lineId};supplier:${supplierId}`, req.user.id]);
    res.status(201).json({ rfq_line_id: lineId, supplier_id: supplierId });
  } catch (_) { res.status(500).json({ error: 'Erro ao registrar proposta' }); }
});
router.post('/rfqs/:id/award', write, async (req, res) => {
  const rfqId = id(req.params.id), bidId = id(req.body?.bid_id);
  const requisitionId = req.body?.requisition_id == null ? null : id(req.body.requisition_id);
  if (!rfqId || !bidId || (req.body?.requisition_id != null && !requisitionId)) return res.status(400).json({ error: 'Proposta ou requisição inválida' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rfqs] = await connection.execute('SELECT status FROM request_for_quotes WHERE id=? AND org_id=? FOR UPDATE', [rfqId, req.user.org_id]);
    if (!rfqs.length) { await connection.rollback();return res.status(404).json({ error: 'RFQ não encontrada' }); }
    if (rfqs[0].status !== 'closed') { await connection.rollback();return res.status(409).json({ error: 'Feche a RFQ antes da adjudicação' }); }
    const [bids] = await connection.execute("SELECT b.id,b.rfq_line_id,b.supplier_id,b.unit_price,b.currency,b.lead_time_days,l.material_id FROM rfq_bids b JOIN rfq_lines l ON l.id=b.rfq_line_id AND l.org_id=b.org_id WHERE b.id=? AND b.org_id=? AND l.rfq_id=? AND b.status='submitted' FOR UPDATE", [bidId, req.user.org_id, rfqId]);
    if (!bids.length) { await connection.rollback();return res.status(404).json({ error: 'Proposta não encontrada' }); }
    const bid = bids[0];
    const [qualified] = await connection.execute("SELECT q.id FROM supplier_qualifications q JOIN suppliers s ON s.id=q.supplier_id AND (BINARY s.org_id=BINARY q.org_id OR s.org_id IS NULL) WHERE q.supplier_id=? AND q.org_id=? AND q.category='MRO' AND q.status='qualified' AND (q.expires_at IS NULL OR q.expires_at>=CURRENT_DATE) AND s.is_active=1", [bid.supplier_id, req.user.org_id]);
    if (!qualified.length) { await connection.rollback();return res.status(409).json({ error: 'Fornecedor perdeu a qualificação MRO' }); }
    let purchaseOrder = null;let awardedPrice=Number(bid.unit_price);
    if (requisitionId) {
      const [requisitions] = await connection.execute('SELECT material_id,requested_quantity,status FROM purchase_requisitions WHERE id=? AND org_id=? FOR UPDATE', [requisitionId, req.user.org_id]);
      if (!requisitions.length) { await connection.rollback();return res.status(404).json({ error: 'Requisição não encontrada' }); }
      if (requisitions[0].status !== 'approved' || Number(requisitions[0].material_id) !== Number(bid.material_id)) { await connection.rollback();return res.status(409).json({ error: 'Requisição aprovada do mesmo material é necessária' }); }
      const snapshot = await purchaseSnapshot(connection,req.user.org_id,bid.material_id,Number(requisitions[0].requested_quantity),Number(bid.unit_price),req.body?.purchase_unit);
      awardedPrice=snapshot.basePrice;const [created] = await connection.execute('INSERT INTO maintenance_purchase_orders (org_id,requisition_id,supplier_id,material_id,quantity,unit_price,currency,expected_at,created_by,rfq_bid_id,purchase_unit,purchase_factor,purchase_quantity,purchase_unit_price) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [req.user.org_id, requisitionId, bid.supplier_id, bid.material_id, snapshot.baseQuantity, snapshot.basePrice, bid.currency, null, req.user.id, bidId,snapshot.unit,snapshot.factor,snapshot.purchaseQuantity,snapshot.purchasePrice]);
      const poNumber = `MPO-${String(created.insertId).padStart(8, '0')}`;
      await connection.execute('UPDATE maintenance_purchase_orders SET po_number=? WHERE id=? AND org_id=?', [poNumber, created.insertId, req.user.org_id]);
      await connection.execute("UPDATE purchase_requisitions SET status='fulfilled' WHERE id=? AND org_id=?", [requisitionId, req.user.org_id]);
      await connection.execute('INSERT INTO purchase_requisition_audit (org_id,requisition_id,action,detail,actor_id) VALUES (?,?,?,?,?)', [req.user.org_id, requisitionId, 'purchase_order_created', poNumber, req.user.id]);
      purchaseOrder = { id: created.insertId, po_number: poNumber, requisition_id: requisitionId, rfq_bid_id: bidId };
    }
    await connection.execute("UPDATE rfq_bids SET status=CASE WHEN id=? THEN 'selected' ELSE 'rejected' END WHERE rfq_line_id=? AND org_id=?", [bidId, bid.rfq_line_id, req.user.org_id]);
    await connection.execute('INSERT INTO material_sources (org_id,material_id,supplier_id,unit_price,currency,lead_time_days,is_approved,created_by) VALUES (?,?,?,?,?,?,1,?) ON DUPLICATE KEY UPDATE unit_price=VALUES(unit_price),currency=VALUES(currency),lead_time_days=VALUES(lead_time_days),is_approved=1', [req.user.org_id, bid.material_id, bid.supplier_id, awardedPrice, bid.currency, bid.lead_time_days, req.user.id]);
    const [sources] = await connection.execute('SELECT id FROM material_sources WHERE org_id=? AND material_id=? AND supplier_id=?', [req.user.org_id, bid.material_id, bid.supplier_id]);
    await connection.execute('INSERT INTO supplier_price_history (org_id,material_source_id,unit_price,currency,created_by) VALUES (?,?,?,?,?)', [req.user.org_id, sources[0].id, awardedPrice, bid.currency, req.user.id]);
    const [pending] = await connection.execute("SELECT COUNT(*) AS remaining FROM rfq_lines l WHERE l.rfq_id=? AND l.org_id=? AND NOT EXISTS (SELECT 1 FROM rfq_bids b WHERE b.rfq_line_id=l.id AND b.org_id=l.org_id AND b.status='selected')", [rfqId, req.user.org_id]);
    if (Number(pending[0].remaining) === 0) await connection.execute("UPDATE request_for_quotes SET status='awarded' WHERE id=? AND org_id=?", [rfqId, req.user.org_id]);
    await connection.execute('INSERT INTO procurement_audit (org_id,entity_type,entity_id,action,detail,actor_id) VALUES (?,?,?,?,?,?)', [req.user.org_id, 'rfq', rfqId, 'bid_awarded', `bid:${bidId}`, req.user.id]);
    await connection.commit();res.json({ rfq_id: rfqId, bid_id: bidId, status: Number(pending[0].remaining) === 0 ? 'awarded' : 'closed', purchase_order: purchaseOrder });
  } catch (_) { await connection.rollback();res.status(_.status||500).json({ error: _.status?_.message:'Erro ao adjudicar proposta' }); } finally { connection.release(); }
});

router.get('/quotas', async (req, res) => {
  const materialId = req.query.material_id ? id(req.query.material_id) : null;
  if (req.query.material_id && !materialId) return res.status(400).json({ error: 'Material inválido' });
  try { const [rows] = await pool.execute('SELECT q.*,m.code,s.name AS supplier_name FROM material_source_quotas q JOIN materials m ON m.id=q.material_id AND BINARY m.org_id=BINARY q.org_id JOIN suppliers s ON s.id=q.supplier_id AND (BINARY s.org_id=BINARY q.org_id OR s.org_id IS NULL) WHERE q.org_id=? AND (? IS NULL OR q.material_id=?) ORDER BY m.code,s.name', [req.user.org_id, materialId, materialId]);res.json(rows); }
  catch (_) { res.status(500).json({ error: 'Erro ao listar quotas' }); }
});
router.post('/quotas', write, async (req, res) => {
  const materialId = id(req.body?.material_id), supplierId = id(req.body?.supplier_id), quota = req.body?.quota_percent;
  if (!materialId || !supplierId || typeof quota !== 'number' || !Number.isFinite(quota) || quota < 0 || quota > 100) return res.status(400).json({ error: 'Quota inválida' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [materials] = await connection.execute('SELECT id FROM materials WHERE id=? AND org_id=? FOR UPDATE', [materialId, req.user.org_id]);
    if (!materials.length) { await connection.rollback();return res.status(404).json({ error: 'Material não encontrado' }); }
    const [source] = await connection.execute('SELECT id FROM material_sources WHERE org_id=? AND material_id=? AND supplier_id=? AND is_approved=1', [req.user.org_id, materialId, supplierId]);
    if (!source.length) { await connection.rollback();return res.status(404).json({ error: 'Fonte aprovada não encontrada' }); }
    const [quotas] = await connection.execute('SELECT supplier_id,quota_percent FROM material_source_quotas WHERE org_id=? AND material_id=? FOR UPDATE', [req.user.org_id, materialId]);
    const otherTotal = quotas.filter(row => Number(row.supplier_id) !== supplierId).reduce((sum, row) => sum + Number(row.quota_percent), 0);
    if (otherTotal + quota > 100.0001) { await connection.rollback();return res.status(409).json({ error: 'A soma das quotas excede 100%' }); }
    await connection.execute('INSERT INTO material_source_quotas (org_id,material_id,supplier_id,quota_percent,updated_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE quota_percent=VALUES(quota_percent),updated_by=VALUES(updated_by)', [req.user.org_id, materialId, supplierId, quota, req.user.id]);
    await connection.execute('INSERT INTO procurement_audit (org_id,entity_type,entity_id,action,detail,actor_id) VALUES (?,?,?,?,?,?)', [req.user.org_id, 'material', materialId, 'quota_updated', `supplier:${supplierId};quota:${quota}`, req.user.id]);
    await connection.commit();res.json({ material_id: materialId, supplier_id: supplierId, quota_percent: quota });
  } catch (_) { await connection.rollback();res.status(500).json({ error: 'Erro ao salvar quota' }); } finally { connection.release(); }
});

module.exports = router;
