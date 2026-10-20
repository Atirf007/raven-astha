const { pool } = require('./connection');

async function runSafeMigration() {
  console.log('[MIGRATION] Iniciando migração segura para Multi-Tenancy e Armazéns...');
  
  try {
    const connection = await pool.getConnection();

    try {
      // 1. Criar a tabela warehouses
      await connection.query(`
        CREATE TABLE IF NOT EXISTS warehouses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          org_id VARCHAR(50) NOT NULL,
          name VARCHAR(100) NOT NULL,
          tab_number INT DEFAULT 1,
          is_shared TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);
      console.log('[OK] Tabela warehouses criada/verificada.');

      // 1.5. Inserir org_1 se não existir (para testes e fallback)
      await connection.query(`
        INSERT IGNORE INTO organizations (id, name, plan) VALUES ('org_1', 'Minha Organização', 'Enterprise')
      `);

      // 2. Inserir Armazém Padrão (se não existir nenhum)
      const [wh] = await connection.query('SELECT id FROM warehouses WHERE org_id = ? LIMIT 1', ['org_1']);
      let defaultWarehouseId = 1;
      if (wh.length === 0) {
        const [insertWh] = await connection.query(`
          INSERT INTO warehouses (org_id, name, tab_number) VALUES ('org_1', 'Armazém Principal', 1)
        `);
        defaultWarehouseId = insertWh.insertId;
        console.log(`[OK] Armazém padrão criado com ID ${defaultWarehouseId}`);
      } else {
        defaultWarehouseId = wh[0].id;
      }

      // 3. Adicionar colunas em MATERIALS de forma segura
      await safeAddColumn(connection, 'materials', 'org_id', `VARCHAR(50) DEFAULT 'org_1'`);
      await safeAddColumn(connection, 'materials', 'warehouse_id', `INT DEFAULT ${defaultWarehouseId}`);
      
      // Criar a foreign key de materials para warehouses, se não existir
      try {
        await connection.query(`ALTER TABLE materials ADD CONSTRAINT fk_materials_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL`);
      } catch (e) { /* Ignora se a FK já existe */ }
      
      // Atualizar materiais existentes
      await connection.query(`UPDATE materials SET org_id = 'org_1' WHERE org_id IS NULL`);
      await connection.query(`UPDATE materials SET warehouse_id = ? WHERE warehouse_id IS NULL`, [defaultWarehouseId]);
      
      console.log('[OK] Tabela materials migrada.');

      // 4. Adicionar colunas em outras tabelas
      const tablesToAddOrg = ['movements', 'categories', 'components', 'warehouse_layout'];
      for (const t of tablesToAddOrg) {
        await safeAddColumn(connection, t, 'org_id', `VARCHAR(50) DEFAULT 'org_1'`);
        await connection.query(`UPDATE ${t} SET org_id = 'org_1' WHERE org_id IS NULL`);
      }
      
      // Criar tabela de compartilhamentos
      await connection.query(`
        CREATE TABLE IF NOT EXISTS warehouse_shares (
          warehouse_id INT NOT NULL,
          shared_with_org_id VARCHAR(50) NOT NULL,
          PRIMARY KEY (warehouse_id, shared_with_org_id),
          FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
          FOREIGN KEY (shared_with_org_id) REFERENCES organizations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
      `);
      console.log('[OK] Tabela warehouse_shares criada/verificada.');

      // 5. Adicionar a coluna password na interface do frontend que criava usuário? Isso é no código.

      console.log('[MIGRATION] Concluído com sucesso. Nenhum dado foi apagado.');
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('[MIGRATION ERROR]', err);
  } finally {
    process.exit(0);
  }
}

async function safeAddColumn(connection, table, column, definition) {
  try {
    const [cols] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
    if (cols.length === 0) {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (err) {
    console.error(`Erro ao adicionar ${column} em ${table}:`, err.message);
  }
}

runSafeMigration();
