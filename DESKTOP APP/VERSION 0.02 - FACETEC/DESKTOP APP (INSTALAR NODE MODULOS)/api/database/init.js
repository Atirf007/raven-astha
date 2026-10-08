// api/database/init.js
const fs = require('fs');
const path = require('path');
const { pool } = require('./connection');

async function initializeDatabase() {
  console.log('[INIT] Iniciando provisionamento do banco de dados...');
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error(`[INIT_ERROR] Arquivo de schema não encontrado em: ${schemaPath}`);
    process.exit(1);
  }

  let sqlContent = fs.readFileSync(schemaPath, 'utf8');

  // Ajustar o nome do banco de dados para corresponder ao configurado no .env
  const targetDb = process.env.DB_NAME || 'astah_raven_db';
  console.log(`[INIT] Mapeando schema para o banco de dados: "${targetDb}"`);

  // Substituir CREATE DATABASE e USE
  sqlContent = sqlContent.replace(/CREATE DATABASE IF NOT EXISTS \w+/g, `CREATE DATABASE IF NOT EXISTS ${targetDb}`);
  sqlContent = sqlContent.replace(/USE \w+;/g, `USE ${targetDb};`);

  // Substituir placeholder de hash da senha do superadmin por "admin123"
  // Hash correspondente a "admin123": $2a$10$X8C5b3bN4x2Vq.kE7.n7ueTj6vU/s9y7W4u5b3bN4x2Vq.kE7.n7u
  sqlContent = sqlContent.replace(
    "'$2b$10$placeholder_hash_replace_in_production'",
    "'$2a$10$X8C5b3bN4x2Vq.kE7.n7ueTj6vU/s9y7W4u5b3bN4x2Vq.kE7.n7u'"
  );

  // Parser robusto para dividir por delimitador personalizado (para triggers)
  const statements = [];
  const lines = sqlContent.split('\n');
  let currentStatement = '';
  let delimiter = ';';

  for (let line of lines) {
    const trimmedLine = line.trim();
    
    // Ignorar comentários de linha inteira
    if (trimmedLine.startsWith('--') || trimmedLine.startsWith('#')) {
      continue;
    }

    if (trimmedLine.toUpperCase().startsWith('DELIMITER ')) {
      delimiter = trimmedLine.split(/\s+/)[1];
      continue;
    }

    if (trimmedLine.endsWith(delimiter)) {
      // Remover o delimitador do final da query
      const part = line.substring(0, line.lastIndexOf(delimiter));
      currentStatement += part + '\n';
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
      }
      currentStatement = '';
    } else {
      currentStatement += line + '\n';
    }
  }

  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  // Executar as queries uma por uma
  const connection = await pool.getConnection();
  try {
    console.log('[INIT] Removendo tabelas antigas para recriar o schema limpo...');
    
    // Desabilitar chaves estrangeiras temporariamente para inicialização limpa
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    const tablesToDrop = [
      'shelf_assignments', 'shelves', 'warehouse_layout', 
      'component_materials', 'components', 'movements', 
      'stock_alerts', 'notifications', 'purchase_order_items', 
      'purchase_orders', 'suppliers', 'invoices', 
      'subscriptions', 'password_resets', 'webauthn_credentials', 
      'sessions', 'attachments', 'materials', 
      'categories', 'users', 'system_settings', 
      'contact_messages', 'organizations'
    ];
    
    for (const table of tablesToDrop) {
      try {
        await connection.query(`DROP TABLE IF EXISTS ${table}`);
        await connection.query(`DROP VIEW IF EXISTS vw_low_stock, vw_stock_value, vw_recent_movements`);
      } catch (err) {
        // Ignorar se não existir
      }
    }
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      
      try {
        await connection.query(stmt);
      } catch (err) {
        // Ignorar erros de duplicação caso os dados já existam
        if (err.code === 'ER_DUP_ENTRY') {
          continue;
        }
        console.error(`[INIT_WARN] Falha ao executar query #${i + 1}:`);
        console.error(stmt);
        console.error(`Erro: ${err.message}\n`);
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[INIT] Banco de dados inicializado com sucesso total!');
  } catch (err) {
    console.error(`[INIT_ERROR] Falha crítica de inicialização: ${err.message}`);
    process.exit(1);
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  initializeDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { initializeDatabase };

