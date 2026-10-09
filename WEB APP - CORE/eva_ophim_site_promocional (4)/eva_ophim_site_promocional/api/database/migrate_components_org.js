const { pool } = require('./connection');

async function migrateComponentsOrg() {
  const connection = await pool.getConnection();
  try {
    const [columns] = await connection.execute(
      "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='components' AND COLUMN_NAME='org_id'"
    );
    const [rows] = await connection.execute(`
      SELECT c.id, u.org_id AS creator_org, MIN(m.org_id) AS material_org,
             COUNT(DISTINCT m.org_id) AS material_org_count
      FROM components c
      LEFT JOIN users u ON u.id=c.created_by
      LEFT JOIN component_materials cm ON cm.component_id=c.id
      LEFT JOIN materials m ON m.id=cm.material_id
      GROUP BY c.id,u.org_id
    `);
    const assignments = rows.map(row => {
      const orgId = row.creator_org || (row.material_org_count === 1 ? row.material_org : null);
      if (!orgId || row.material_org_count > 1 || (row.material_org && row.creator_org && row.material_org !== row.creator_org)) {
        throw new Error('Há componentes legados sem organização única; revise-os antes da migração.');
      }
      return { id: row.id, orgId };
    });

    if (!columns.length) await connection.query('ALTER TABLE components ADD COLUMN org_id VARCHAR(50) NULL');
    for (const assignment of assignments) {
      await connection.execute('UPDATE components SET org_id=? WHERE id=? AND org_id IS NULL', [assignment.orgId, assignment.id]);
    }
    const [unassigned] = await connection.execute('SELECT COUNT(*) AS total FROM components WHERE org_id IS NULL');
    if (unassigned[0].total) throw new Error('Ainda há componentes sem organização; migração interrompida.');
    if (!columns.length || columns[0].IS_NULLABLE === 'YES') {
      await connection.query('ALTER TABLE components MODIFY COLUMN org_id VARCHAR(50) NOT NULL');
    }

    const [indexes] = await connection.execute(
      "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='components' AND COLUMN_NAME='org_id' LIMIT 1"
    );
    if (!indexes.length) await connection.query('ALTER TABLE components ADD INDEX idx_components_org_id (org_id)');
    const [foreignKeys] = await connection.execute(
      "SELECT 1 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='components' AND COLUMN_NAME='org_id' AND REFERENCED_TABLE_NAME='organizations' LIMIT 1"
    );
    if (!foreignKeys.length) {
      await connection.query('ALTER TABLE components ADD CONSTRAINT fk_components_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE');
    }
    console.log('Organização dos componentes verificada.');
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  migrateComponentsOrg().catch(error => {
    console.error('Falha ao migrar componentes:', error.code || error.message);
    process.exitCode = 1;
  }).finally(() => pool.end());
}

module.exports = { migrateComponentsOrg };
