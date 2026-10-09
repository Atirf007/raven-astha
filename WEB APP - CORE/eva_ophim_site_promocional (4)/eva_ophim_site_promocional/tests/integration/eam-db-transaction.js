// Run explicitly with RUN_EAM_DB_INTEGRATION=1. All test rows are rolled back.
if (process.env.RUN_EAM_DB_INTEGRATION !== '1') {
  console.log('EAM_DB_INTEGRATION_NOT_EXECUTED');
  process.exit(0);
}

const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
process.chdir(path.resolve(__dirname, '../../api'));
const { pool } = require('../../api/database/connection');

async function run() {
  const orgId = `codex_eam_${randomUUID().replace(/-/g, '').slice(0, 30)}`;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const insert = 'INSERT INTO assets (org_id, asset_code, name, asset_type, status, location, functional_location, functional_location_id, equipment_model_id, manufacturer, model, serial_number, criticality, metadata, parent_asset_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const base = [orgId, null, null, 'equipment', 'active', null, null, null, null, 'Test', 'Test', null, 'medium', '{}', null, null];
    const parent = [...base];
    parent[1] = 'CODEX-ROOT'; parent[2] = 'Teste de ativo principal';
    const [createdParent] = await connection.execute(insert, parent);
    const child = [...base];
    child[1] = 'CODEX-CHILD'; child[2] = 'Teste de ativo filho'; child[14] = createdParent.insertId;
    const [createdChild] = await connection.execute(insert, child);
    const [rows] = await connection.execute('SELECT id, parent_asset_id FROM assets WHERE org_id=? AND id IN (?,?) ORDER BY id', [orgId, createdParent.insertId, createdChild.insertId]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].parent_asset_id, null);
    assert.equal(rows[1].parent_asset_id, createdParent.insertId);

    const [visual] = await connection.execute('INSERT INTO equipment_visuals (org_id,equipment_id,type,orientation,title,description,revision,status,filename,mime_type,file_data,file_url,file_size_kb,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [orgId, createdChild.insertId, 'photo', 'custom', 'Foto de teste', null, null, 'draft', 'teste.png', 'image/png', Buffer.from([137,80,78,71,13,10,26,10]).toString('base64'), null, 1, null]);
    const [document] = await connection.execute('INSERT INTO technical_documents (org_id,equipment_id,owner_type,owner_id,document_number,title,document_type,description,created_by) VALUES (?,?,?,?,?,?,?,?,?)', [orgId, createdChild.insertId, 'equipment', createdChild.insertId, 'CODEX-MANUAL', 'Manual de teste', 'manual', null, null]);
    const [revision] = await connection.execute('INSERT INTO technical_document_revisions (org_id,document_id,revision_code,filename,mime_type,file_data,file_url,file_size_kb,change_description,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)', [orgId, document.insertId, 'A', 'teste.pdf', 'application/pdf', Buffer.from('%PDF-1.4\n').toString('base64'), null, 1, null, null]);
    await connection.execute('UPDATE technical_documents SET current_revision_id=? WHERE id=? AND org_id=?', [revision.insertId, document.insertId, orgId]);
    const [linked] = await connection.execute('SELECT d.current_revision_id, v.id AS visual_id FROM technical_documents d JOIN equipment_visuals v ON v.equipment_id=d.equipment_id AND v.org_id=d.org_id WHERE d.id=? AND d.org_id=?', [document.insertId, orgId]);
    assert.equal(linked[0].current_revision_id, revision.insertId);
    assert.equal(linked[0].visual_id, visual.insertId);
    console.log('EAM_DB_TRANSACTION_PASS');
  } finally {
    await connection.rollback();
    connection.release();
    const [remaining] = await pool.execute('SELECT COUNT(*) AS count FROM assets WHERE org_id=?', [orgId]);
    assert.equal(remaining[0].count, 0);
    await pool.end();
  }
}

run().catch(error => { console.error(`EAM_DB_TRANSACTION_FAILED:${error.code || error.name}`); process.exitCode = 1; });
