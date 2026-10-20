/* material-files.js — Anexos por Material (3D, PDFs, Diagramas) */
const express = require('express');
const router  = express.Router();
const { pool } = require('../database/connection');
const verifyToken = require('../middleware/auth');
const { validateAttachment, safeUrl } = require('../security/attachments');
router.use(verifyToken);
router.use((req, res, next) => {
  if (!req.user.org_id) return res.status(403).json({ error: 'Organização obrigatória' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !['superadmin', 'admin', 'manager'].includes(req.user.role)) return res.status(403).json({ error: 'Permissão insuficiente' });
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ── GET /api/materials/:code/files
router.get('/:code/files', async (req, res) => {
  try {
    const [mat] = await pool.execute('SELECT id FROM materials WHERE code = ? AND org_id = ?', [req.params.code, req.user.org_id]);
    if (!mat.length) return res.status(404).json({ error: 'Material não encontrado' });

    const [files] = await pool.execute(
      'SELECT id, category, filename, mime_type, file_url, description, file_size_kb, created_at FROM material_files WHERE material_id = ? ORDER BY category, created_at ASC',
      [mat[0].id]
    );
    res.json(files.map(f => ({ ...f, file_url: f.file_url ? safeUrl(f.file_url) : null })));
  } catch (err) {
    console.error('GET /files error:', err);
    res.status(500).json({ error: 'Erro ao processar arquivo' });
  }
});

// ── GET /api/materials/:code/files/:id/data  (download)
router.get('/:code/files/:id/data', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT f.filename, f.mime_type, f.file_data, f.file_url FROM material_files f JOIN materials m ON f.material_id = m.id WHERE f.id = ? AND m.code = ? AND m.org_id = ?',
      [req.params.id, req.params.code, req.user.org_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Arquivo não encontrado' });
    const f = rows[0];
    if (f.file_data) {
      // Strip data: prefix if stored with it
      const raw = f.file_data.includes(',') ? f.file_data.split(',')[1] : f.file_data;
      const buf = Buffer.from(raw, 'base64');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(f.filename)}"`);
      return res.send(buf);
    }
    if (f.file_url && safeUrl(f.file_url)) return res.redirect(safeUrl(f.file_url));
    res.status(404).json({ error: 'Sem dados de arquivo' });
  } catch (err) {
    console.error('GET /files/:id/data error:', err);
    res.status(500).json({ error: 'Erro ao processar arquivo' });
  }
});

// ── POST /api/materials/:code/files
router.post('/:code/files', async (req, res) => {
  try {
    const [mat] = await pool.execute('SELECT id FROM materials WHERE code = ? AND org_id = ?', [req.params.code, req.user.org_id]);
    if (!mat.length) return res.status(404).json({ error: 'Material não encontrado' });

    const { category, filename, mime_type, file_data, file_url, description } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename é obrigatório' });
    if (!category) return res.status(400).json({ error: 'category é obrigatório' });

    if (!['product_3d', 'machinery_3d', 'manual', 'electrical', 'mechanical', 'other'].includes(category) || (description != null && (typeof description !== 'string' || description.length > 500))) return res.status(400).json({ error: 'Metadados inválidos' });
    let file;
    try { file = validateAttachment(req.body); } catch { return res.status(400).json({ error: 'Arquivo inválido: verifique tipo, conteúdo e limite de 10 MiB' }); }
    const size_kb = file.size;

    const [result] = await pool.execute(
      'INSERT INTO material_files (material_id, category, filename, mime_type, file_data, file_url, description, file_size_kb) VALUES (?,?,?,?,?,?,?,?)',
      [mat[0].id, category, file.filename, file.mime_type, file.file_data, file.file_url, description || null, size_kb]
    );

    res.status(201).json({ id: result.insertId, category, filename, mime_type: file.mime_type, description, file_size_kb: size_kb });
  } catch (err) {
    console.error('POST /files error:', err);
    res.status(500).json({ error: 'Erro ao processar arquivo' });
  }
});

// ── PATCH /api/materials/files/:id  (update description)
router.patch('/files/:id', async (req, res) => {
  try {
    const { description } = req.body;
    if (description != null && (typeof description !== 'string' || description.length > 500)) return res.status(400).json({ error: 'Descrição inválida' });
    const [result] = await pool.execute('UPDATE material_files f JOIN materials m ON f.material_id = m.id SET f.description = ? WHERE f.id = ? AND m.org_id = ?', [description || null, req.params.id, req.user.org_id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Arquivo não encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar arquivo' });
  }
});

// ── DELETE /api/materials/files/:id
router.delete('/files/:id', async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE f FROM material_files f JOIN materials m ON f.material_id = m.id WHERE f.id = ? AND m.org_id = ?', [req.params.id, req.user.org_id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Arquivo não encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /files/:id error:', err);
    res.status(500).json({ error: 'Erro ao processar arquivo' });
  }
});

module.exports = router;
