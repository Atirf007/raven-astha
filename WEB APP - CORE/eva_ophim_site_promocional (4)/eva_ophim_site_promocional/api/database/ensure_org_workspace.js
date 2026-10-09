const { pool } = require('./connection');

// Additive schema only. Existing EAM locations and users remain untouched.
async function ensureOrgWorkspace() {
  // A single metadata round trip for already migrated installations.
  const [metadata] = await pool.execute(`SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH AS max_length, NULL AS INDEX_NAME
    FROM information_schema.columns WHERE table_schema=DATABASE()
    AND table_name IN ('org_profile_design','org_positions','org_chart','org_invites',
      'org_map_hub','org_units','org_access_groups','org_access_group_members','organizations')
    UNION ALL SELECT TABLE_NAME,NULL,NULL,NULL,INDEX_NAME FROM information_schema.statistics
    WHERE table_schema=DATABASE() AND table_name='org_units' AND index_name='uq_org_unit_functional_location'`);
  const tables = new Set(metadata.map(row => row.TABLE_NAME));
  const unitColumns = new Set(metadata.filter(row => row.TABLE_NAME === 'org_units').map(row => row.COLUMN_NAME));
  const logo = metadata.find(row => row.TABLE_NAME === 'organizations' && row.COLUMN_NAME === 'logo_url');
  const schemaReady = ['org_profile_design','org_positions','org_chart','org_invites','org_map_hub','org_units','org_access_groups','org_access_group_members'].every(name => tables.has(name))
    && ['legal_name','tax_id','state_registration','address','city','state','postal_code','image_url'].every(name => unitColumns.has(name))
    && metadata.some(row => row.TABLE_NAME === 'organizations' && row.COLUMN_NAME === 'workspace_type')
    && metadata.some(row => row.INDEX_NAME === 'uq_org_unit_functional_location')
    && logo && (['mediumtext','longtext'].includes(logo.DATA_TYPE) || Number(logo.max_length) >= 50000);
  if (schemaReady) { await repairOrganizationNames(); return; }

  await pool.execute(`CREATE TABLE IF NOT EXISTS org_profile_design (
    org_id VARCHAR(50) NOT NULL PRIMARY KEY,
    cover_image MEDIUMTEXT NULL,
    links_json TEXT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  // Older installations may have organization columns but never ran the
  // non-destructive positions/invites migration. Provision only missing tables.
  await pool.execute(`CREATE TABLE IF NOT EXISTS org_positions (
    id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL, department VARCHAR(100) DEFAULT NULL,
    level INT DEFAULT 3, color VARCHAR(20) DEFAULT '#4A6CF7',
    permissions JSON DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_org_positions_org (org_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS org_chart (
    id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL,
    user_id INT DEFAULT NULL, position_id INT DEFAULT NULL, reports_to INT DEFAULT NULL,
    node_label VARCHAR(200) DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_org_chart_org (org_id), INDEX idx_org_chart_reports (reports_to)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS org_invites (
    id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE, email VARCHAR(200) DEFAULT NULL,
    role VARCHAR(50) DEFAULT 'viewer', position_id INT DEFAULT NULL,
    used_by INT DEFAULT NULL, used_at TIMESTAMP NULL DEFAULT NULL,
    expires_at TIMESTAMP NOT NULL, created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_org_invites_org (org_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await repairOrganizationNames();
  const [workspaceTypeColumn] = await pool.execute(`SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='organizations' AND column_name='workspace_type' LIMIT 1`);
  if (!workspaceTypeColumn.length) await pool.execute(`ALTER TABLE organizations ADD COLUMN workspace_type VARCHAR(20) NOT NULL DEFAULT 'corporate'`);
  const [logoColumn] = await pool.execute(`SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS max_length FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='organizations' AND column_name='logo_url' LIMIT 1`);
  if (!logoColumn.length) {
    await pool.execute('ALTER TABLE organizations ADD COLUMN logo_url MEDIUMTEXT NULL');
  } else if (!['mediumtext', 'longtext'].includes(logoColumn[0].DATA_TYPE)
    && Number(logoColumn[0].max_length || 0) < 50_000) {
    await pool.execute('ALTER TABLE organizations MODIFY COLUMN logo_url MEDIUMTEXT NULL');
  }
  await pool.execute(`CREATE TABLE IF NOT EXISTS org_map_hub (
    org_id VARCHAR(50) NOT NULL PRIMARY KEY,
    maps_json LONGTEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS org_units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL,
    unit_type VARCHAR(24) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    parent_id INT NULL,
    manager_user_id INT NULL,
    functional_location_id INT NULL,
    description VARCHAR(1000) NULL,
    legal_name VARCHAR(200) NULL,
    tax_id VARCHAR(20) NULL,
    state_registration VARCHAR(40) NULL,
    address VARCHAR(300) NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(50) NULL,
    postal_code VARCHAR(16) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_org_unit_code (org_id, unit_type, code),
    UNIQUE KEY uq_org_unit_functional_location (org_id, functional_location_id),
    INDEX idx_org_units_parent (org_id, parent_id),
    INDEX idx_org_units_location (org_id, functional_location_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [locationIndex] = await pool.execute(`SELECT 1 FROM information_schema.statistics
    WHERE table_schema=DATABASE() AND table_name='org_units' AND index_name='uq_org_unit_functional_location' LIMIT 1`);
  if (!locationIndex.length) await pool.execute('ALTER TABLE org_units ADD UNIQUE KEY uq_org_unit_functional_location (org_id, functional_location_id)');
  const branchFields = [
    ['legal_name', 'VARCHAR(200) NULL'], ['tax_id', 'VARCHAR(20) NULL'],
    ['state_registration', 'VARCHAR(40) NULL'], ['address', 'VARCHAR(300) NULL'],
    ['city', 'VARCHAR(100) NULL'], ['state', 'VARCHAR(50) NULL'], ['postal_code', 'VARCHAR(16) NULL']
  ];
  const [existingUnitColumns] = await pool.execute("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='org_units'");
  const existingColumns = new Set(existingUnitColumns.map(row => row.COLUMN_NAME));
  for (const [column, definition] of branchFields) {
    // Column names and definitions come only from the constant allowlist above.
    if (!existingColumns.has(column)) await pool.execute(`ALTER TABLE org_units ADD COLUMN ${column} ${definition}`);
  }
  if (!existingColumns.has('image_url')) await pool.execute('ALTER TABLE org_units ADD COLUMN image_url MEDIUMTEXT NULL');
  await pool.execute(`CREATE TABLE IF NOT EXISTS org_access_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(500) NULL,
    permissions JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_org_group_code (org_id, code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS org_access_group_members (
    org_id VARCHAR(50) NOT NULL,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (org_id, group_id, user_id),
    INDEX idx_org_group_user (org_id, user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function repairOrganizationNames() {
  const [brokenNames] = await pool.execute('SELECT id, name FROM organizations WHERE name LIKE ?', ['OrganizaÃ§Ã£o de %']);
  for (const organization of brokenNames) {
    if (organization.name.startsWith('OrganizaÃ§Ã£o de ')) {
      await pool.execute('UPDATE organizations SET name = ? WHERE id = ?', [organization.name.replace(/^OrganizaÃ§Ã£o de /, 'Organização de '), organization.id]);
    }
  }

}

module.exports = ensureOrgWorkspace;
