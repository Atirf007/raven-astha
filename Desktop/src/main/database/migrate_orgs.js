/* ============================================================
   Migration: Organizations Full Schema
   Adds: org_positions, org_chart, org_invites
   Expands: organizations table
   ============================================================ */
const { pool } = require('./connection');

async function runOrgMigration() {
  console.log('[ORG-MIGRATION] Iniciando migração de organizações...');
  const connection = await pool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Expand organizations table with missing columns
    const orgCols = [
      ['slug',        "VARCHAR(100) DEFAULT NULL"],
      ['cnpj',        "VARCHAR(20) DEFAULT NULL"],
      ['email',       "VARCHAR(200) DEFAULT NULL"],
      ['phone',       "VARCHAR(30) DEFAULT NULL"],
      ['address',     "TEXT DEFAULT NULL"],
      ['city',        "VARCHAR(100) DEFAULT NULL"],
      ['state',       "VARCHAR(50) DEFAULT NULL"],
      ['logo_url',    "TEXT DEFAULT NULL"],
      ['setup_done',  "TINYINT(1) NOT NULL DEFAULT 0"],
      ['owner_id',    "INT DEFAULT NULL"],
      ['created_at',  "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"],
    ];
    for (const [col, def] of orgCols) {
      await safeAddColumn(connection, 'organizations', col, def);
    }
    console.log('[OK] Tabela organizations expandida.');

    // 2. Create org_positions table (Cargos)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS org_positions (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        org_id      VARCHAR(50) NOT NULL,
        name        VARCHAR(100) NOT NULL,
        department  VARCHAR(100) DEFAULT NULL,
        level       INT DEFAULT 3 COMMENT '1=Diretoria, 2=Gerência, 3=Operacional',
        color       VARCHAR(20) DEFAULT '#4A6CF7',
        permissions JSON DEFAULT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_org_positions_org (org_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[OK] Tabela org_positions criada.');

    // 3. Create org_chart table (Organograma)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS org_chart (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        org_id       VARCHAR(50) NOT NULL,
        user_id      INT DEFAULT NULL,
        position_id  INT DEFAULT NULL,
        reports_to   INT DEFAULT NULL COMMENT 'FK para org_chart.id (nó pai)',
        node_label   VARCHAR(200) DEFAULT NULL COMMENT 'Nome quando não há user vinculado',
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_org_chart_org (org_id),
        INDEX idx_org_chart_reports (reports_to)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[OK] Tabela org_chart criada.');

    // 4. Create org_invites table (Convites)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS org_invites (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        org_id       VARCHAR(50) NOT NULL,
        code         VARCHAR(20) NOT NULL UNIQUE,
        email        VARCHAR(200) DEFAULT NULL COMMENT 'Se null, qualquer um com o código pode entrar',
        role         VARCHAR(50) DEFAULT 'viewer',
        position_id  INT DEFAULT NULL,
        used_by      INT DEFAULT NULL,
        used_at      TIMESTAMP NULL DEFAULT NULL,
        expires_at   TIMESTAMP NOT NULL,
        created_by   INT NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_org_invites_code (code),
        INDEX idx_org_invites_org (org_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[OK] Tabela org_invites criada.');

    // 5. Add setup_done and position_id to users table
    await safeAddColumn(connection, 'users', 'setup_done', 'TINYINT(1) NOT NULL DEFAULT 0');
    await safeAddColumn(connection, 'users', 'position_id', 'INT DEFAULT NULL');
    await safeAddColumn(connection, 'users', 'position_label', "VARCHAR(100) DEFAULT NULL");
    console.log('[OK] Tabela users expandida.');

    // 6. Mark existing users as setup complete (they already went through old flow)
    await connection.query(`UPDATE users SET setup_done = 1 WHERE setup_done = 0`);

    // 7. Mark org_1 as setup complete
    await connection.query(`UPDATE organizations SET setup_done = 1 WHERE id = 'org_1'`);

    // 8. Fix the broken user (id=2 with inverted email/name)
    await connection.query(`
      UPDATE users SET 
        name = 'Admin Teste',
        email = 'admin1@gmail.com',
        setup_done = 1
      WHERE id = 2 AND name = 'admin1@gmail.com'
    `);
    console.log('[OK] Usuário de teste corrigido (campos invertidos).');

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[ORG-MIGRATION] ✅ Concluída com sucesso!');
  } catch (err) {
    console.error('[ORG-MIGRATION ERROR]', err);
  } finally {
    connection.release();
  }
}

async function safeAddColumn(connection, table, column, definition) {
  try {
    const [cols] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
    if (cols.length === 0) {
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      console.log(`  [+] Coluna ${column} adicionada em ${table}`);
    }
  } catch (err) {
    console.log(`  [!] Coluna ${column} em ${table}: ${err.message}`);
  }
}

if (require.main === module) {
  runOrgMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runOrgMigration };
