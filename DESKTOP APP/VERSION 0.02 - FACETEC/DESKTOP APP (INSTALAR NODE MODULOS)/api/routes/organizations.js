/* ============================================================
   Organizations Routes — /api/org
   Full multi-tenant org management: info, positions, chart, invites
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authMiddleware);

// ── Helper: verify user belongs to requested org ──────────────
function assertOrg(req, res) {
  if (!req.user || !req.user.org_id) {
    res.status(403).json({ error: 'Sem organização associada' });
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════
// ORGANIZATION INFO
// ═══════════════════════════════════════════════════

// GET /api/org/me — dados da organização atual
router.get('/me', async (req, res) => {
  if (!assertOrg(req, res)) return;
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, slug, cnpj, email, phone, address, city, state, logo_url, plan, setup_done, created_at FROM organizations WHERE id = ?',
      [req.user.org_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Organização não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /org/me error:', err);
    res.status(500).json({ error: 'Erro ao buscar organização' });
  }
});

// PUT /api/org/me — atualizar dados da organização (somente admin+)
router.put('/me', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão para editar a organização' });
  }
  try {
    const { name, cnpj, email, phone, address, city, state, logo_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    await pool.execute(
      `UPDATE organizations SET name=?, cnpj=?, email=?, phone=?, address=?, city=?, state=?, logo_url=?
       WHERE id = ?`,
      [name, cnpj || null, email || null, phone || null, address || null, city || null, state || null, logo_url || null, req.user.org_id]
    );
    res.json({ message: 'Organização atualizada com sucesso' });
  } catch (err) {
    console.error('PUT /org/me error:', err);
    res.status(500).json({ error: 'Erro ao atualizar organização' });
  }
});

// POST /api/org/complete-setup — marca setup como concluído
router.post('/complete-setup', async (req, res) => {
  if (!assertOrg(req, res)) return;
  try {
    await pool.execute('UPDATE organizations SET setup_done = 1 WHERE id = ?', [req.user.org_id]);
    await pool.execute('UPDATE users SET setup_done = 1 WHERE id = ?', [req.user.id]);
    res.json({ message: 'Setup concluído' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao finalizar setup' });
  }
});

// ═══════════════════════════════════════════════════
// POSITIONS (Cargos)
// ═══════════════════════════════════════════════════

// GET /api/org/positions
router.get('/positions', async (req, res) => {
  if (!assertOrg(req, res)) return;
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM org_positions WHERE org_id = ? ORDER BY level ASC, name ASC',
      [req.user.org_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar cargos' });
  }
});

// POST /api/org/positions — criar cargo
router.post('/positions', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão para criar cargos' });
  }
  try {
    const { name, department, level, color, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do cargo é obrigatório' });

    const [result] = await pool.execute(
      `INSERT INTO org_positions (org_id, name, department, level, color, permissions)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.org_id,
        name,
        department || null,
        level || 3,
        color || '#4A6CF7',
        permissions ? JSON.stringify(permissions) : JSON.stringify({
          can_view: true, can_edit: false, can_delete: false, can_manage_users: false
        })
      ]
    );
    const [newPos] = await pool.execute('SELECT * FROM org_positions WHERE id = ?', [result.insertId]);
    res.status(201).json(newPos[0]);
  } catch (err) {
    console.error('POST /org/positions error:', err);
    res.status(500).json({ error: 'Erro ao criar cargo' });
  }
});

// PUT /api/org/positions/:id — editar cargo
router.put('/positions/:id', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  try {
    // IDOR check: verify position belongs to org
    const [existing] = await pool.execute(
      'SELECT id FROM org_positions WHERE id = ? AND org_id = ?',
      [req.params.id, req.user.org_id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Cargo não encontrado' });

    const { name, department, level, color, permissions } = req.body;
    await pool.execute(
      `UPDATE org_positions SET name=?, department=?, level=?, color=?, permissions=?
       WHERE id = ? AND org_id = ?`,
      [name, department || null, level || 3, color || '#4A6CF7',
       permissions ? JSON.stringify(permissions) : null,
       req.params.id, req.user.org_id]
    );
    res.json({ message: 'Cargo atualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar cargo' });
  }
});

// DELETE /api/org/positions/:id
router.delete('/positions/:id', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM org_positions WHERE id = ? AND org_id = ?',
      [req.params.id, req.user.org_id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Cargo não encontrado' });

    await pool.execute('DELETE FROM org_positions WHERE id = ? AND org_id = ?', [req.params.id, req.user.org_id]);
    res.json({ message: 'Cargo removido' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover cargo' });
  }
});

// ═══════════════════════════════════════════════════
// ORG CHART (Organograma)
// ═══════════════════════════════════════════════════

// GET /api/org/chart
router.get('/chart', async (req, res) => {
  if (!assertOrg(req, res)) return;
  try {
    const [nodes] = await pool.execute(
      `SELECT oc.id, oc.org_id, oc.user_id, oc.position_id, oc.reports_to, oc.node_label,
              u.name AS user_name, u.email AS user_email, u.avatar_url,
              p.name AS position_name, p.department, p.level AS position_level, p.color AS position_color
       FROM org_chart oc
       LEFT JOIN users u ON oc.user_id = u.id
       LEFT JOIN org_positions p ON oc.position_id = p.id
       WHERE oc.org_id = ?
       ORDER BY p.level ASC, oc.id ASC`,
      [req.user.org_id]
    );
    res.json(nodes);
  } catch (err) {
    console.error('GET /org/chart error:', err);
    res.status(500).json({ error: 'Erro ao buscar organograma' });
  }
});

// POST /api/org/chart — adicionar nó
router.post('/chart', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  try {
    const { user_id, position_id, reports_to, node_label } = req.body;
    if (!position_id) return res.status(400).json({ error: 'Cargo é obrigatório' });

    // Validate position belongs to org
    const [pos] = await pool.execute(
      'SELECT id FROM org_positions WHERE id = ? AND org_id = ?',
      [position_id, req.user.org_id]
    );
    if (!pos.length) return res.status(400).json({ error: 'Cargo inválido' });

    const [result] = await pool.execute(
      `INSERT INTO org_chart (org_id, user_id, position_id, reports_to, node_label)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.org_id, user_id || null, position_id, reports_to || null, node_label || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao adicionar ao organograma' });
  }
});

// DELETE /api/org/chart/:id
router.delete('/chart/:id', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM org_chart WHERE id = ? AND org_id = ?',
      [req.params.id, req.user.org_id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Nó não encontrado' });

    await pool.execute('DELETE FROM org_chart WHERE id = ? AND org_id = ?', [req.params.id, req.user.org_id]);
    res.json({ message: 'Nó removido' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover nó' });
  }
});

// ═══════════════════════════════════════════════════
// USERS WITHIN ORG
// ═══════════════════════════════════════════════════

// GET /api/org/users — listar membros
router.get('/users', async (req, res) => {
  if (!assertOrg(req, res)) return;
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_url, u.position_label, u.is_active, u.created_at,
              p.name AS position_name, p.department, p.level AS position_level
       FROM users u
       LEFT JOIN org_positions p ON u.position_id = p.id
       WHERE u.org_id = ?
       ORDER BY u.name ASC`,
      [req.user.org_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// PUT /api/org/users/:id — atualizar role/cargo de membro
router.put('/users/:id', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  try {
    // IDOR: verify user belongs to same org
    const [target] = await pool.execute(
      'SELECT id FROM users WHERE id = ? AND org_id = ?',
      [req.params.id, req.user.org_id]
    );
    if (!target.length) return res.status(404).json({ error: 'Usuário não encontrado nesta organização' });

    const { role, position_id, position_label } = req.body;
    const validRoles = ['superadmin', 'admin', 'editor', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role inválida' });
    }

    await pool.execute(
      'UPDATE users SET role = COALESCE(?, role), position_id = ?, position_label = ? WHERE id = ? AND org_id = ?',
      [role || null, position_id || null, position_label || null, req.params.id, req.user.org_id]
    );
    res.json({ message: 'Usuário atualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// ═══════════════════════════════════════════════════
// INVITES
// ═══════════════════════════════════════════════════

// POST /api/org/invites — gerar código de convite
router.post('/invites', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão para gerar convites' });
  }
  try {
    const { email, role, position_id, expires_hours } = req.body;
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // ex: A3F7B2C1
    const expiresAt = new Date(Date.now() + (expires_hours || 48) * 60 * 60 * 1000);

    await pool.execute(
      `INSERT INTO org_invites (org_id, code, email, role, position_id, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.org_id, code, email || null, role || 'viewer', position_id || null, expiresAt, req.user.id]
    );

    const [org] = await pool.execute('SELECT name FROM organizations WHERE id = ?', [req.user.org_id]);
    res.status(201).json({
      code,
      org_name: org[0]?.name,
      expires_at: expiresAt,
      message: `Código de convite gerado: ${code}`
    });
  } catch (err) {
    console.error('POST /org/invites error:', err);
    res.status(500).json({ error: 'Erro ao gerar convite' });
  }
});

// GET /api/org/invites — listar convites ativos
router.get('/invites', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  try {
    const [rows] = await pool.execute(
      `SELECT i.*, u.name AS used_by_name, p.name AS position_name
       FROM org_invites i
       LEFT JOIN users u ON i.used_by = u.id
       LEFT JOIN org_positions p ON i.position_id = p.id
       WHERE i.org_id = ?
       ORDER BY i.created_at DESC`,
      [req.user.org_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar convites' });
  }
});

// ═══════════════════════════════════════════════════
// EVENTS (Calendar)
// ═══════════════════════════════════════════════════

router.get('/events', async (req, res) => {
  if (!assertOrg(req, res)) return;
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM events WHERE org_id = ? ORDER BY event_date ASC`,
      [req.user.org_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar eventos' });
  }
});

router.post('/events', async (req, res) => {
  if (!assertOrg(req, res)) return;
  try {
    const { title, date, sector, color } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'Título e data são obrigatórios' });
    
    const [result] = await pool.execute(
      `INSERT INTO events (org_id, title, event_date, sector, color) VALUES (?, ?, ?, ?, ?)`,
      [req.user.org_id, title, date, sector || 'Geral', color || '#6366f1']
    );
    res.status(201).json({ id: result.insertId, message: 'Evento criado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

router.delete('/events/:id', async (req, res) => {
  if (!assertOrg(req, res)) return;
  try {
    await pool.execute(
      `DELETE FROM events WHERE id = ? AND org_id = ?`,
      [req.params.id, req.user.org_id]
    );
    res.json({ message: 'Evento excluído' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir evento' });
  }
});

module.exports = router;
