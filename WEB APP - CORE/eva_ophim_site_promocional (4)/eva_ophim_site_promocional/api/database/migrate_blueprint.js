const { pool } = require('./connection');

async function runBlueprintMigration() {
  console.log('[MIGRATION] Iniciando atualização de schema para Blueprint 2D/3D...');
  
  try {
    const connection = await pool.getConnection();

    try {
      // Adicionar a coluna blueprint_data na tabela warehouse_layout
      const [cols] = await connection.query(`SHOW COLUMNS FROM warehouse_layout LIKE 'blueprint_data'`);
      if (cols.length === 0) {
        await connection.query(`ALTER TABLE warehouse_layout ADD COLUMN blueprint_data LONGTEXT`);
        console.log('[OK] Coluna blueprint_data adicionada.');
      } else {
        console.log('[INFO] Coluna blueprint_data já existe.');
      }

      console.log('[MIGRATION] Concluído com sucesso.');
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('[MIGRATION ERROR]', err);
  } finally {
    process.exit(0);
  }
}

runBlueprintMigration();
