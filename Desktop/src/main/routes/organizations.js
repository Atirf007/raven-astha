/* ============================================================
   Organizations Routes — /api/org
   Full multi-tenant org management: info, positions, chart, invites
   ============================================================ */
const express = require('express');
const { pool } = require('../database/connection');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');
const { validateProfile } = require('../security/organization-profile');
const { signToken, expiresAt } = require('../security/tokens');

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
      'SELECT id, name, slug, cnpj, email, phone, address, city, state, logo_url, workspace_type, plan, setup_done, created_at FROM organizations WHERE id = ?',
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
    const { name, cnpj, email, phone, address, city, state, workspace_type } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 200) {
      return res.status(400).json({ error: 'Informe a razão social (até 200 caracteres)' });
    }
    const optionalFields = { cnpj: 20, email: 200, phone: 30, address: 5000, city: 100, state: 50 };
    for (const [field, limit] of Object.entries(optionalFields)) {
      const value = req.body[field];
      if (value != null && (typeof value !== 'string' || value.trim().length > limit)) {
        return res.status(400).json({ error: `Campo ${field} inválido` });
      }
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'E-mail corporativo inválido' });
    }
    if (workspace_type != null && (!['personal', 'corporate'].includes(workspace_type) || req.user.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Tipo de workspace inválido ou sem permissão' });
    }
    if(workspace_type!=null){const [current]=await pool.execute('SELECT workspace_type,setup_done FROM organizations WHERE id=?',[req.user.org_id]);if(!current.length)return res.status(404).json({error:'Organização não encontrada.'});if(current[0].setup_done&&current[0].workspace_type!==workspace_type)return res.status(403).json({error:'O tipo de uso não pode ser alterado após a configuração inicial.'});}

    const [updated] = await pool.execute(
      `UPDATE organizations SET name=?, cnpj=?, email=?, phone=?, address=?, city=?, state=?, workspace_type=COALESCE(?, workspace_type)
       WHERE id = ? AND (? IS NULL OR workspace_type=? OR setup_done=0)`,
      [name.trim(), cnpj?.trim() || null, email?.trim() || null, phone?.trim() || null, address?.trim() || null, city?.trim() || null, state?.trim() || null, workspace_type || null, req.user.org_id,workspace_type||null,workspace_type||null]
    );
    if(!updated.affectedRows)return res.status(409).json({error:'A configuração mudou. Recarregue antes de continuar.'});
    res.json({ message: 'Organização atualizada com sucesso' });
  } catch (err) {
    console.error('PUT /org/me error:', err);
    res.status(500).json({ error: 'Erro ao atualizar organização' });
  }
});

router.get('/profile-design', async (req, res) => {
  if (!assertOrg(req, res)) return;
  try {
    const [rows] = await pool.execute('SELECT cover_image, links_json FROM org_profile_design WHERE org_id = ?', [req.user.org_id]);
    res.json({ cover_image: rows[0]?.cover_image || null, links: rows.length ? JSON.parse(rows[0].links_json) : [] });
  } catch (error) { res.status(500).json({ error: 'Não foi possível carregar a capa e os links.' }); }
});
router.put('/profile-design', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['admin', 'superadmin'].includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão para editar o perfil corporativo.' });
  let profile;
  try { profile = validateProfile(req.body); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    await pool.execute('INSERT INTO org_profile_design (org_id, cover_image, links_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE cover_image=VALUES(cover_image), links_json=VALUES(links_json)', [req.user.org_id, profile.cover_image, JSON.stringify(profile.links)]);
    res.json(profile);
  } catch (error) { res.status(500).json({ error: 'Não foi possível salvar a capa e os links.' }); }
});

router.put('/logo', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão para alterar a marca da organização' });
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'logo')) return res.status(400).json({ error: 'Imagem não informada' });
  const logo = req.body?.logo;
  if (logo !== null && (typeof logo !== 'string' || logo.length > 50_000)) return res.status(400).json({ error: 'Imagem inválida ou grande demais' });
  if (logo) {
    const match = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=]+)$/i.exec(logo);
    if (!match) return res.status(400).json({ error: 'Use uma imagem PNG, JPG ou WebP' });
    const bytes = Buffer.from(match[2], 'base64');
    const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
    const jpg = bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
    const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!bytes.length || bytes.length > 37_000 || !(match[1].toLowerCase() === 'png' ? png : match[1].toLowerCase() === 'jpeg' ? jpg : webp)) {
      return res.status(400).json({ error: 'Arquivo de imagem inválido' });
    }
  }
  try {
    await pool.execute('UPDATE organizations SET logo_url = ? WHERE id = ?', [logo || null, req.user.org_id]);
    res.json({ logo_url: logo || null });
  } catch (err) {
    console.error('PUT /org/logo:', err.code || err.name);
    res.status(500).json({ error: 'Não foi possível salvar a imagem' });
  }
});

// POST /api/org/complete-setup — marca setup como concluído
router.post('/complete-setup', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Apenas o proprietário pode concluir a configuração' });
  try {
    const [org] = await pool.execute('SELECT owner_id, name FROM organizations WHERE id = ?', [req.user.org_id]);
    if (!org.length || Number(org[0].owner_id) !== Number(req.user.id) || !org[0].name?.trim() || /^Organiza(?:ção|Ã§Ã£o) de /i.test(org[0].name)) {
      return res.status(400).json({ error: 'Informe o nome do workspace antes de concluir a configuração' });
    }
    await pool.execute('UPDATE organizations SET setup_done = 1 WHERE id = ?', [req.user.org_id]);
    await pool.execute('UPDATE users SET setup_done = 1 WHERE id = ?', [req.user.id]);
    res.json({ message: 'Setup concluído' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao finalizar setup' });
  }
});

// Claim a single-use invitation while the account still owns only its pending workspace.
router.post('/join', async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  if (!/^[A-F0-9]{8}$/.test(code)) return res.status(400).json({ error: 'Código de convite inválido' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [users] = await connection.execute('SELECT id, email, org_id, setup_done FROM users WHERE id = ? FOR UPDATE', [req.user.id]);
    const [pending] = await connection.execute('SELECT id, owner_id, setup_done FROM organizations WHERE id = ? FOR UPDATE', [req.user.org_id]);
    if (!users.length || Number(users[0].setup_done) || !pending.length || Number(pending[0].setup_done) || Number(pending[0].owner_id) !== Number(req.user.id)) {
      await connection.rollback(); return res.status(403).json({ error: 'Este convite só pode ser usado durante a configuração inicial' });
    }
    const [invites] = await connection.execute(`SELECT id, org_id, email, role, position_id
      FROM org_invites WHERE code = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE`, [code]);
    const invite = invites[0];
    if (!invite || (invite.email && invite.email.toLowerCase() !== users[0].email.toLowerCase()) || !['admin','manager','operator','viewer'].includes(invite.role)) {
      await connection.rollback(); return res.status(400).json({ error: 'Convite inválido, expirado ou de outro e-mail' });
    }
    const [destinations] = await connection.execute('SELECT name, setup_done FROM organizations WHERE id = ? FOR UPDATE', [invite.org_id]);
    if (!destinations.length || !Number(destinations[0].setup_done)) {
      await connection.rollback(); return res.status(400).json({ error: 'Organização do convite ainda não está pronta' });
    }
    await connection.execute('UPDATE org_invites SET used_at = NOW(), used_by = ? WHERE id = ? AND used_at IS NULL', [req.user.id, invite.id]);
    await connection.execute('UPDATE users SET org_id = ?, role = ?, position_id = ?, setup_done = 1 WHERE id = ? AND org_id = ?', [invite.org_id, invite.role, invite.position_id || null, req.user.id, req.user.org_id]);
    await connection.execute('DELETE FROM sessions WHERE user_id = ?', [req.user.id]);
    const token = signToken({ id: req.user.id, email: users[0].email, role: invite.role, org_id: invite.org_id });
    await connection.execute(`INSERT INTO sessions (user_id, token, provider, ip_address, user_agent, expires_at)
      VALUES (?, ?, 'local', ?, ?, ?)`, [req.user.id, token, req.ip, req.get('User-Agent') || '', expiresAt(token)]);
    await connection.commit();
    res.json({ token, org_name: destinations[0].name, org_id: invite.org_id, role: invite.role });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('POST /org/join:', err.code || err.name);
    res.status(500).json({ error: 'Não foi possível aceitar o convite' });
  } finally { if (connection) connection.release(); }
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

    if (user_id) {
      const [users] = await pool.execute('SELECT id FROM users WHERE id = ? AND org_id = ?', [user_id, req.user.org_id]);
      if (!users.length) return res.status(400).json({ error: 'Usuário inválido' });
    }
    if (reports_to) {
      const [parents] = await pool.execute('SELECT id FROM org_chart WHERE id = ? AND org_id = ?', [reports_to, req.user.org_id]);
      if (!parents.length) return res.status(400).json({ error: 'Gestor inválido' });
    }

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
      `SELECT u.id, u.name, u.surname, u.email, u.phone, u.company, u.sector, u.role, u.avatar_url, u.position_id, u.position_label, u.is_active, u.created_at,
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
      'SELECT id, role FROM users WHERE id = ? AND org_id = ?',
      [req.params.id, req.user.org_id]
    );
    if (!target.length) return res.status(404).json({ error: 'Usuário não encontrado nesta organização' });

    const { role, position_id, position_label } = req.body;
    const validRoles = ['superadmin', 'admin', 'manager', 'operator', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role inválida' });
    }
    if (req.user.role !== 'superadmin' && (role === 'superadmin' || target[0].role === 'superadmin')) {
      return res.status(403).json({ error: 'Somente superadmin pode alterar esta função' });
    }
    if (position_id) {
      const [positions] = await pool.execute('SELECT id FROM org_positions WHERE id = ? AND org_id = ?', [position_id, req.user.org_id]);
      if (!positions.length) return res.status(400).json({ error: 'Cargo inválido' });
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
    const allowedInviteRoles = req.user.role === 'superadmin'
      ? ['admin', 'manager', 'operator', 'viewer'] : ['manager', 'operator', 'viewer'];
    if (!allowedInviteRoles.includes(role || 'viewer') || (email != null && (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) || !Number.isSafeInteger(expires_hours || 48) || (expires_hours || 48) < 1 || (expires_hours || 48) > 168) return res.status(400).json({ error: 'Convite inválido' });
    if (position_id != null) {
      if (!Number.isSafeInteger(position_id) || position_id < 1) return res.status(400).json({ error: 'Cargo inválido' });
      const [positions] = await pool.execute('SELECT id FROM org_positions WHERE id = ? AND org_id = ?', [position_id, req.user.org_id]);
      if (!positions.length) return res.status(400).json({ error: 'Cargo inválido' });
    }
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
  if (!['superadmin', 'admin', 'manager'].includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão' });
  try {
    const { title, date, sector, color } = req.body;
    if (typeof title !== 'string' || !title.trim() || title.length > 160 ||
        typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-Z]*)?$/.test(date) ||
        (sector != null && (typeof sector !== 'string' || sector.length > 100)) ||
        (color != null && (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)))) {
      return res.status(400).json({ error: 'Dados do evento inválidos' });
    }
    
    const [result] = await pool.execute(
      `INSERT INTO events (org_id, title, event_date, sector, color) VALUES (?, ?, ?, ?, ?)`,
      [req.user.org_id, title.trim(), date, sector || 'Geral', color || '#6366f1']
    );
    res.status(201).json({ id: result.insertId, message: 'Evento criado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

router.delete('/events/:id', async (req, res) => {
  if (!assertOrg(req, res)) return;
  if (!['superadmin', 'admin', 'manager'].includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão' });
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
