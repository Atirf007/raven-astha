const express = require('express');
const { pool } = require('../database/connection');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);
const types = new Set(['branch', 'business_unit', 'department', 'cost_center', 'location']);
const parentTypes = {
  branch: new Set(),
  business_unit: new Set(['branch']),
  department: new Set(['branch', 'business_unit']),
  cost_center: new Set(['branch', 'business_unit', 'department']),
  location: new Set(['branch', 'business_unit', 'department', 'cost_center', 'location'])
};
const resources = ['wms', 'components', 'eam'];
const isAdmin = req => ['admin', 'superadmin'].includes(req.user?.role);
const id = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const clean = (value, limit) => typeof value === 'string' && value.trim() && value.trim().length <= limit ? value.trim() : null;
const branchLimits = { legal_name: 200, tax_id: 20, state_registration: 40, address: 300, city: 100, state: 50, postal_code: 16 };
function validUnitImage(value) {
  if (value == null) return true;
  if (typeof value !== 'string' || value.length > 50_000) return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=]+)$/i.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 37_000) return false;
  if (match[1].toLowerCase() === 'png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (match[1].toLowerCase() === 'jpeg') return bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}
function branchValues(body) {
  if (body.unit_type !== 'branch') return Object.keys(branchLimits).map(() => null);
  return Object.entries(branchLimits).map(([key, limit]) => {
    const value = body[key];
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || value.trim().length > limit) throw new Error('BRANCH');
    return value.trim() || null;
  });
}
const adminOnly = (req, res, next) => isAdmin(req) ? next() : res.status(403).json({ error: 'Apenas administradores podem alterar a estrutura.' });

function validPermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some(key => !resources.includes(key))) return null;
  const result = {};
  for (const resource of resources) {
    const grant = value[resource] || {};
    if (!grant || typeof grant !== 'object' || Array.isArray(grant) || Object.keys(grant).some(key => !['read', 'write'].includes(key))) return null;
    if (Object.values(grant).some(item => typeof item !== 'boolean')) return null;
    result[resource] = { read: Boolean(grant.read || grant.write), write: Boolean(grant.write) };
  }
  return result;
}

async function unitRelations(req, body, existingId = null) {
  const parentId = body.parent_id == null || body.parent_id === '' ? null : id(body.parent_id);
  const managerId = body.manager_user_id == null || body.manager_user_id === '' ? null : id(body.manager_user_id);
  const locationId = body.functional_location_id == null || body.functional_location_id === '' ? null : id(body.functional_location_id);
  if ((body.parent_id && !parentId) || (body.manager_user_id && !managerId) || (body.functional_location_id && !locationId)) throw new Error('INVALID');
  if (parentId) {
    if (parentId === existingId) throw new Error('CYCLE');
    const [parent] = await pool.execute('SELECT id, unit_type, parent_id FROM org_units WHERE id=? AND org_id=?', [parentId, req.user.org_id]);
    if (!parent.length || !parentTypes[body.unit_type].has(parent[0].unit_type)) throw new Error('PARENT');
    let cursor = parent[0];
    const seen = new Set();
    while (cursor?.parent_id) {
      if (cursor.parent_id === existingId || seen.has(cursor.parent_id)) throw new Error('CYCLE');
      seen.add(cursor.parent_id);
      const [rows] = await pool.execute('SELECT id, parent_id FROM org_units WHERE id=? AND org_id=?', [cursor.parent_id, req.user.org_id]);
      cursor = rows[0];
    }
  }
  if (body.unit_type === 'branch' && parentId) throw new Error('PARENT');
  if (managerId) {
    const [users] = await pool.execute('SELECT id FROM users WHERE id=? AND org_id=?', [managerId, req.user.org_id]);
    if (!users.length) throw new Error('MANAGER');
  }
  if (locationId) {
    if (body.unit_type !== 'location') throw new Error('LOCATION');
    const [locations] = await pool.execute('SELECT id FROM functional_locations WHERE id=? AND org_id=?', [locationId, req.user.org_id]);
    if (!locations.length) throw new Error('LOCATION');
    const [linked] = await pool.execute('SELECT id FROM org_units WHERE functional_location_id=? AND org_id=? AND id<>? LIMIT 1', [locationId, req.user.org_id, existingId || 0]);
    if (linked.length) throw new Error('LOCATION');
  }
  return { parentId, managerId, locationId };
}

function unitError(error, res) {
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Código já cadastrado nesta categoria.' });
  if (['INVALID', 'PARENT', 'CYCLE', 'MANAGER', 'LOCATION', 'BRANCH'].includes(error.message)) return res.status(400).json({ error: 'Dados ou vínculo organizacional inválidos.' });
  return res.status(500).json({ error: 'Falha ao salvar a estrutura organizacional.' });
}

router.get('/units', async (req, res) => {
  try {
    const [units] = await pool.execute(`SELECT u.*, m.name AS manager_name, fl.location_code AS functional_location_code
      FROM org_units u LEFT JOIN users m ON m.id=u.manager_user_id AND BINARY m.org_id=BINARY u.org_id
      LEFT JOIN functional_locations fl ON fl.id=u.functional_location_id AND BINARY fl.org_id=BINARY u.org_id
      WHERE u.org_id=? ORDER BY FIELD(u.unit_type,'branch','business_unit','department','cost_center','location'),u.code`, [req.user.org_id]);
    res.json(units);
  } catch (error) { console.error('[ORG_UNITS_GET]', error.code || error.message); res.status(500).json({ error: 'Falha ao carregar a estrutura organizacional.' }); }
});

router.post('/units', adminOnly, async (req, res) => {
  const b = req.body || {};
  if (!types.has(b.unit_type) || !clean(b.code, 64) || !clean(b.name, 200) || (b.status && !['active', 'inactive'].includes(b.status)) || (b.description != null && b.description !== '' && !clean(b.description, 1000)) || !validUnitImage(b.image_url)) return res.status(400).json({ error: 'Dados ou imagem da unidade inválidos.' });
  try {
    const rel = await unitRelations(req, b);
    const branch = branchValues(b);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      let locationId = rel.locationId;
      if (b.unit_type === 'location') {
        const [parents] = rel.parentId ? await connection.execute('SELECT unit_type,code,functional_location_id FROM org_units WHERE id=? AND org_id=?', [rel.parentId, req.user.org_id]) : [[]];
        const parent = parents[0];
        const costCenter = parent?.unit_type === 'cost_center' ? parent.code : null;
        if (!locationId) {
          const [location] = await connection.execute(`INSERT INTO functional_locations (org_id,location_code,name,parent_location_id,cost_center,status)
            VALUES (?,?,?,?,?,?)`, [req.user.org_id, b.code.trim(), b.name.trim(), parent?.unit_type === 'location' ? parent.functional_location_id : null, costCenter, b.status || 'active']);
          locationId = location.insertId;
        } else {
          await connection.execute('UPDATE functional_locations SET location_code=?,name=?,cost_center=?,status=? WHERE id=? AND org_id=?',
            [b.code.trim(), b.name.trim(), costCenter, b.status || 'active', locationId, req.user.org_id]);
        }
      }
      const [result] = await connection.execute(`INSERT INTO org_units (org_id,unit_type,code,name,parent_id,manager_user_id,functional_location_id,description,status,created_by,
        legal_name,tax_id,state_registration,address,city,state,postal_code,image_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [req.user.org_id, b.unit_type, b.code.trim(), b.name.trim(), rel.parentId, rel.managerId, locationId, b.description?.trim() || null, b.status || 'active', req.user.id, ...branch, b.image_url || null]);
      await connection.commit();
      res.status(201).json({ id: result.insertId, functional_location_id: locationId });
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  } catch (error) { unitError(error, res); }
});

router.put('/units/:id', adminOnly, async (req, res) => {
  const unitId = id(req.params.id);
  if (!unitId) return res.status(400).json({ error: 'Unidade inválida.' });
  try {
    const [existing] = await pool.execute('SELECT * FROM org_units WHERE id=? AND org_id=?', [unitId, req.user.org_id]);
    if (!existing.length) return res.status(404).json({ error: 'Unidade não encontrada.' });
    const b = { ...existing[0], ...(req.body || {}), unit_type: existing[0].unit_type };
    if (!clean(b.code, 64) || !clean(b.name, 200) || !['active', 'inactive'].includes(b.status) || (b.description != null && b.description !== '' && !clean(b.description, 1000)) || !validUnitImage(b.image_url)) return res.status(400).json({ error: 'Dados ou imagem da unidade inválidos.' });
    const rel = await unitRelations(req, b, unitId);
    const branch = branchValues(b);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      let locationId = rel.locationId;
      if (b.unit_type === 'location') {
        const [parents] = rel.parentId ? await connection.execute('SELECT unit_type,code,functional_location_id FROM org_units WHERE id=? AND org_id=?', [rel.parentId, req.user.org_id]) : [[]];
        const parent = parents[0], costCenter = parent?.unit_type === 'cost_center' ? parent.code : null;
        if (!locationId) {
          const [location] = await connection.execute(`INSERT INTO functional_locations (org_id,location_code,name,parent_location_id,cost_center,status)
            VALUES (?,?,?,?,?,?)`, [req.user.org_id, b.code.trim(), b.name.trim(), parent?.unit_type === 'location' ? parent.functional_location_id : null, costCenter, b.status]);
          locationId = location.insertId;
        } else {
          await connection.execute('UPDATE functional_locations SET location_code=?,name=?,cost_center=?,status=? WHERE id=? AND org_id=?',
            [b.code.trim(), b.name.trim(), costCenter, b.status, locationId, req.user.org_id]);
        }
      }
      await connection.execute(`UPDATE org_units SET code=?,name=?,parent_id=?,manager_user_id=?,functional_location_id=?,description=?,status=?,
        legal_name=?,tax_id=?,state_registration=?,address=?,city=?,state=?,postal_code=?,image_url=? WHERE id=? AND org_id=?`,
        [b.code.trim(), b.name.trim(), rel.parentId, rel.managerId, locationId, b.description?.trim() || null, b.status, ...branch, b.image_url || null, unitId, req.user.org_id]);
      if (b.unit_type === 'cost_center') {
        await connection.execute(`UPDATE functional_locations fl JOIN org_units u ON u.functional_location_id=fl.id AND BINARY u.org_id=BINARY fl.org_id
          SET fl.cost_center=? WHERE u.parent_id=? AND u.unit_type='location' AND u.org_id=?`, [b.code.trim(), unitId, req.user.org_id]);
      }
      await connection.commit();
      res.json({ id: unitId, functional_location_id: locationId });
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  } catch (error) { unitError(error, res); }
});

router.delete('/units/:id', adminOnly, async (req, res) => {
  const unitId = id(req.params.id);
  if (!unitId) return res.status(400).json({ error: 'Unidade inválida.' });
  try {
    const [units] = await pool.execute('SELECT functional_location_id FROM org_units WHERE id=? AND org_id=?', [unitId, req.user.org_id]);
    if (!units.length) return res.status(404).json({ error: 'Unidade não encontrada.' });
    const [children] = await pool.execute('SELECT id FROM org_units WHERE parent_id=? AND org_id=? LIMIT 1', [unitId, req.user.org_id]);
    if (children.length) return res.status(409).json({ error: 'Remova ou transfira as unidades subordinadas primeiro.' });
    if (units[0].functional_location_id) {
      const [assets] = await pool.execute('SELECT id FROM assets WHERE functional_location_id=? AND org_id=? LIMIT 1', [units[0].functional_location_id, req.user.org_id]);
      if (assets.length) return res.status(409).json({ error: 'Há ativos nesta localização. Desative a unidade ou transfira os ativos antes de excluir.' });
    }
    const [result] = await pool.execute('DELETE FROM org_units WHERE id=? AND org_id=?', [unitId, req.user.org_id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Unidade não encontrada.' });
    res.json({ id: unitId });
  } catch (_) { res.status(500).json({ error: 'Falha ao remover a unidade.' }); }
});

router.get('/cost-centers/:id/summary', async (req, res) => {
  const centerId = id(req.params.id);
  if (!centerId) return res.status(400).json({ error: 'Centro de custo inválido.' });
  try {
    const [centers] = await pool.execute("SELECT id,code,name FROM org_units WHERE id=? AND org_id=? AND unit_type='cost_center'", [centerId, req.user.org_id]);
    if (!centers.length) return res.status(404).json({ error: 'Centro de custo não encontrado.' });
    const [assets] = await pool.execute(`SELECT COUNT(a.id) AS total FROM org_units loc JOIN assets a
      ON a.functional_location_id=loc.functional_location_id AND BINARY a.org_id=BINARY loc.org_id
      WHERE loc.parent_id=? AND loc.unit_type='location' AND loc.org_id=?`, [centerId, req.user.org_id]);
    const [orders] = await pool.execute(`SELECT COUNT(wo.id) AS total FROM org_units loc JOIN assets a
      ON a.functional_location_id=loc.functional_location_id AND BINARY a.org_id=BINARY loc.org_id
      JOIN maintenance_work_orders wo ON wo.asset_id=a.id AND BINARY wo.org_id=BINARY a.org_id
      WHERE loc.parent_id=? AND loc.unit_type='location' AND loc.org_id=?`, [centerId, req.user.org_id]);
    const [materials] = await pool.execute(`SELECT COALESCE(SUM(wom.material_cost),0) AS total FROM org_units loc JOIN assets a
      ON a.functional_location_id=loc.functional_location_id AND BINARY a.org_id=BINARY loc.org_id
      JOIN maintenance_work_orders wo ON wo.asset_id=a.id AND BINARY wo.org_id=BINARY a.org_id
      JOIN work_order_materials wom ON wom.work_order_id=wo.id AND BINARY wom.org_id=BINARY wo.org_id
      WHERE loc.parent_id=? AND loc.unit_type='location' AND loc.org_id=?`, [centerId, req.user.org_id]);
    const [labor] = await pool.execute(`SELECT COALESCE(SUM(wol.labor_cost),0) AS total FROM org_units loc JOIN assets a
      ON a.functional_location_id=loc.functional_location_id AND BINARY a.org_id=BINARY loc.org_id
      JOIN maintenance_work_orders wo ON wo.asset_id=a.id AND BINARY wo.org_id=BINARY a.org_id
      JOIN work_order_labor wol ON wol.work_order_id=wo.id AND BINARY wol.org_id=BINARY wo.org_id
      WHERE loc.parent_id=? AND loc.unit_type='location' AND loc.org_id=?`, [centerId, req.user.org_id]);
    const materialCost = Number(materials[0].total), laborCost = Number(labor[0].total);
    res.json({ center: centers[0], asset_count: Number(assets[0].total), work_order_count: Number(orders[0].total), material_cost: materialCost, labor_cost: laborCost, total_cost: materialCost + laborCost });
  } catch (error) { console.error('[ORG_CENTER_SUMMARY]', error.code || error.message); res.status(500).json({ error: 'Falha ao calcular custos de manutenção.' }); }
});

router.get('/groups', async (req, res) => {
  try {
    const [groups] = await pool.execute(`SELECT g.*, COUNT(m.user_id) AS member_count FROM org_access_groups g
      LEFT JOIN org_access_group_members m ON m.group_id=g.id AND m.org_id=g.org_id WHERE g.org_id=? GROUP BY g.id ORDER BY g.name`, [req.user.org_id]);
    const [members] = await pool.execute('SELECT group_id,user_id FROM org_access_group_members WHERE org_id=?', [req.user.org_id]);
    res.json({ groups, members });
  } catch (_) { res.status(500).json({ error: 'Falha ao carregar grupos.' }); }
});

router.post('/groups', adminOnly, async (req, res) => {
  const b = req.body || {}, permissions = validPermissions(b.permissions);
  if (!clean(b.code, 64) || !clean(b.name, 160) || (b.description != null && b.description !== '' && !clean(b.description, 500)) || !permissions) return res.status(400).json({ error: 'Grupo ou permissões inválidos.' });
  try {
    const [result] = await pool.execute('INSERT INTO org_access_groups (org_id,code,name,description,permissions) VALUES (?,?,?,?,?)', [req.user.org_id, b.code.trim(), b.name.trim(), b.description?.trim() || null, JSON.stringify(permissions)]);
    res.status(201).json({ id: result.insertId });
  } catch (error) { res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Código de grupo já existe.' : 'Falha ao criar grupo.' }); }
});

router.put('/groups/:id', adminOnly, async (req, res) => {
  const groupId = id(req.params.id), b = req.body || {}, permissions = validPermissions(b.permissions);
  if (!groupId || !clean(b.code, 64) || !clean(b.name, 160) || (b.description != null && b.description !== '' && !clean(b.description, 500)) || !permissions) return res.status(400).json({ error: 'Grupo ou permissões inválidos.' });
  try {
    const [result] = await pool.execute('UPDATE org_access_groups SET code=?,name=?,description=?,permissions=? WHERE id=? AND org_id=?', [b.code.trim(), b.name.trim(), b.description?.trim() || null, JSON.stringify(permissions), groupId, req.user.org_id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Grupo não encontrado.' });
    res.json({ id: groupId });
  } catch (error) { res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Código de grupo já existe.' : 'Falha ao salvar grupo.' }); }
});

router.delete('/groups/:id', adminOnly, async (req, res) => {
  const groupId = id(req.params.id);
  if (!groupId) return res.status(400).json({ error: 'Grupo inválido.' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [found] = await connection.execute('SELECT id FROM org_access_groups WHERE id=? AND org_id=? FOR UPDATE', [groupId, req.user.org_id]);
    if (!found.length) { await connection.rollback(); return res.status(404).json({ error: 'Grupo não encontrado.' }); }
    await connection.execute('DELETE FROM org_access_group_members WHERE group_id=? AND org_id=?', [groupId, req.user.org_id]);
    await connection.execute('DELETE FROM org_access_groups WHERE id=? AND org_id=?', [groupId, req.user.org_id]);
    await connection.commit();
    res.json({ id: groupId });
  } catch (_) { if (connection) await connection.rollback(); res.status(500).json({ error: 'Falha ao remover grupo.' }); }
  finally { connection?.release(); }
});

router.put('/groups/:id/members', adminOnly, async (req, res) => {
  const groupId = id(req.params.id);
  const userIds = req.body?.user_ids;
  if (!groupId || !Array.isArray(userIds) || userIds.length > 500 || userIds.some(value => !id(value)) || new Set(userIds.map(Number)).size !== userIds.length) return res.status(400).json({ error: 'Lista de membros inválida.' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [groups] = await connection.execute('SELECT id FROM org_access_groups WHERE id=? AND org_id=? FOR UPDATE', [groupId, req.user.org_id]);
    if (!groups.length) { await connection.rollback(); return res.status(404).json({ error: 'Grupo não encontrado.' }); }
    for (const userId of userIds) {
      const [users] = await connection.execute('SELECT id FROM users WHERE id=? AND org_id=?', [Number(userId), req.user.org_id]);
      if (!users.length) { await connection.rollback(); return res.status(400).json({ error: 'Pessoa não pertence ao workspace.' }); }
    }
    await connection.execute('DELETE FROM org_access_group_members WHERE group_id=? AND org_id=?', [groupId, req.user.org_id]);
    for (const userId of userIds) await connection.execute('INSERT INTO org_access_group_members (org_id,group_id,user_id) VALUES (?,?,?)', [req.user.org_id, groupId, Number(userId)]);
    await connection.commit();
    res.json({ id: groupId, member_count: userIds.length });
  } catch (_) { if (connection) await connection.rollback(); res.status(500).json({ error: 'Falha ao atribuir membros.' }); }
  finally { connection?.release(); }
});

router.get('/access/me', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT g.permissions FROM org_access_groups g JOIN org_access_group_members m
      ON m.group_id=g.id AND m.org_id=g.org_id WHERE m.org_id=? AND m.user_id=?`, [req.user.org_id, req.user.id]);
    if (isAdmin(req) || !rows.length) return res.json({ restricted: false, permissions: null });
    const permissions = Object.fromEntries(resources.map(resource => [resource, { read: false, write: false }]));
    for (const row of rows) {
      const grants = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
      for (const resource of resources) for (const action of ['read', 'write']) permissions[resource][action] ||= Boolean(grants?.[resource]?.[action]);
    }
    res.json({ restricted: true, permissions });
  } catch (_) { res.status(500).json({ error: 'Falha ao carregar acesso.' }); }
});

module.exports = router;
