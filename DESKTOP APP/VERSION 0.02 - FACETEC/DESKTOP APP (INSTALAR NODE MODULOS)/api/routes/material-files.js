/* material-files.js — Anexos por Material (3D, PDFs, Diagramas) */
const express = require('express');
const router  = express.Router();
const { pool } = require('../database/connection');
const verifyToken = require('../middleware/auth');

// ── GET /api/materials/:code/files
router.get('/:code/files', verifyToken, async (req, res) => {
  try {
    const [mat] = await pool.execute('SELECT id FROM materials WHERE code = ?', [req.params.code]);
    if (!mat.length) return res.status(404).json({ error: 'Material não encontrado' });

    const [files] = await pool.execute(
      'SELECT id, category, filename, mime_type, file_url, description, file_size_kb, created_at FROM material_files WHERE material_id = ? ORDER BY category, created_at ASC',
      [mat[0].id]
    );
    res.json(files);
  } catch (err) {
    console.error('GET /files error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/materials/:code/files/:id/data  (download)
router.get('/:code/files/:id/data', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT filename, mime_type, file_data, file_url FROM material_files WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Arquivo não encontrado' });
    const f = rows[0];
    if (f.file_data) {
      // Strip data: prefix if stored with it
      const raw = f.file_data.includes(',') ? f.file_data.split(',')[1] : f.file_data;
      const buf = Buffer.from(raw, 'base64');
      res.setHeader('Content-Type', f.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(f.filename)}"`);
      return res.send(buf);
    }
    if (f.file_url) return res.redirect(f.file_url);
    res.status(404).json({ error: 'Sem dados de arquivo' });
  } catch (err) {
    console.error('GET /files/:id/data error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/materials/:code/files
router.post('/:code/files', verifyToken, async (req, res) => {
  try {
    const [mat] = await pool.execute('SELECT id FROM materials WHERE code = ?', [req.params.code]);
    if (!mat.length) return res.status(404).json({ error: 'Material não encontrado' });

    const { category, filename, mime_type, file_data, file_url, description } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename é obrigatório' });
    if (!category) return res.status(400).json({ error: 'category é obrigatório' });

    // Estimate size
    let size_kb = null;
    if (file_data) size_kb = Math.round(file_data.length * 0.75 / 1024);

    const [result] = await pool.execute(
      'INSERT INTO material_files (material_id, category, filename, mime_type, file_data, file_url, description, file_size_kb) VALUES (?,?,?,?,?,?,?,?)',
      [mat[0].id, category, filename, mime_type || null, file_data || null, file_url || null, description || null, size_kb]
    );

    res.status(201).json({ id: result.insertId, category, filename, mime_type, description, file_size_kb: size_kb });
  } catch (err) {
    console.error('POST /files error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/materials/files/:id  (update description)
router.patch('/files/:id', verifyToken, async (req, res) => {
  try {
    const { description } = req.body;
    await pool.execute('UPDATE material_files SET description = ? WHERE id = ?', [description || null, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/materials/files/:id
router.delete('/files/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id FROM material_files WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Arquivo não encontrado' });
    await pool.execute('DELETE FROM material_files WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /files/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
