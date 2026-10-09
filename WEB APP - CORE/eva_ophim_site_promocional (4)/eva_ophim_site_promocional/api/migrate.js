/* ====================================================================
   ASTHA RAVEN � Full Database Migration Script v2.0
   Recreates the complete schema and adds missing columns
   ==================================================================== */
require('dotenv').config();
const { pool } = require('./database/connection');
const fs = require('fs');
const path = require('path');

async function migrate() {
  console.log('\n�"�"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"');
  console.log('�"   ASTHA RAVEN � Database Setup v2.0              �"');
  console.log('�"a�"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�\n');

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Step 1 � Drop old incompatible tables
    console.log('�x� Limpando schema antigo...');
    const oldTables = [
      'shelf_assignments','shelves','warehouse_layout',
      'component_materials','components','movements',
      'stock_alerts','notifications','purchase_order_items',
      'purchase_orders','suppliers','invoices',
      'subscriptions','password_resets','webauthn_credentials',
      'sessions','attachments','materials','categories',
      'users','system_settings','contact_messages','organizations',
      'audit_log','plans'
    ];
    for (const t of oldTables) {
      await conn.query(`DROP TABLE IF EXISTS ${t}`).catch(() => {});
      await conn.query(`DROP VIEW IF EXISTS vw_low_stock, vw_stock_value, vw_recent_movements`).catch(() => {});
    }
    console.log('  �S& Schema antigo removido\n');

    // Step 2 � Create full schema
    console.log('�x� Criando schema completo...');
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    let sql = fs.readFileSync(schemaPath, 'utf8');

    // Fix database name to match .env
    const dbName = process.env.DB_NAME || 'astha_raven_db';
    sql = sql.replace(/CREATE DATABASE IF NOT EXISTS \w+/g, `CREATE DATABASE IF NOT EXISTS ${dbName}`);
    sql = sql.replace(/USE \w+;/g, `USE ${dbName};`);
    // Parse and execute statements
    const statements = [];
    let current = '';
    let delimiter = ';';
    for (const line of sql.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('#')) continue;
      if (trimmed.toUpperCase().startsWith('DELIMITER ')) {
        delimiter = trimmed.split(/\s+/)[1];
        continue;
      }
      if (trimmed.endsWith(delimiter)) {
        current += line.substring(0, line.lastIndexOf(delimiter)) + '\n';
        if (current.trim()) statements.push(current.trim());
        current = '';
      } else {
        current += line + '\n';
      }
    }
    if (current.trim()) statements.push(current.trim());

    let ok = 0, skip = 0, errors = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt || stmt.toUpperCase().startsWith('USE ') || stmt.toUpperCase().startsWith('CREATE DATABASE')) continue;
      try {
        await conn.query(stmt);
        ok++;
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY' || e.code === 'ER_TABLE_EXISTS_ERROR') { skip++; }
        else { console.log(`  �a� Stmt #${i+1}: ${e.message.substring(0,80)}`); errors++; }
      }
    }
    console.log(`  �S& Schema criado: ${ok} OK, ${skip} já existentes, ${errors} erros\n`);

    // Step 3 � Add new dedicated columns for material fields (fix ER_DATA_TOO_LONG)
    console.log('�x� Aplicando melhorias v2.1 (colunas dedicadas)...');
    const columnMigrations = [
      { name: 'notes TEXT� LONGTEXT',          sql: 'ALTER TABLE materials MODIFY COLUMN notes LONGTEXT' },
      { name: 'description VARCHAR� TEXT',      sql: 'ALTER TABLE materials MODIFY COLUMN description TEXT NOT NULL' },
      { name: 'interchange_with TEXT� MEDIUMTEXT', sql: 'ALTER TABLE materials MODIFY COLUMN interchange_with MEDIUMTEXT NULL' },
      { name: 'ADD machinery_image',           sql: 'ALTER TABLE materials ADD COLUMN machinery_image MEDIUMTEXT NULL AFTER machinery' },
      { name: 'ADD machinery_desc',            sql: 'ALTER TABLE materials ADD COLUMN machinery_desc TEXT NULL AFTER machinery_image' },
      { name: 'ADD usage_desc',                sql: 'ALTER TABLE materials ADD COLUMN usage_desc TEXT NULL AFTER machinery_desc' },
      { name: 'ADD manufacturer_url',          sql: 'ALTER TABLE materials ADD COLUMN manufacturer_url VARCHAR(500) NULL AFTER usage_desc' },
    ];
    for (const m of columnMigrations) {
      try {
        await conn.query(m.sql);
        console.log(`  �S& ${m.name}`);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log(`  ⏭  SKIP (já existe): ${m.name}`);
        else console.log(`  �a�  ${m.name}: ${e.message.substring(0,60)}`);
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Step 4 � Verify
    console.log('\n�x� Verificando schema final...');
    const [tables] = await conn.query("SHOW TABLES");
    console.log(`  �S& Tabelas criadas: ${tables.length}`);
    tables.forEach(t => console.log(`     ⬢ ${Object.values(t)[0]}`));

    const [cols] = await conn.query('DESCRIBE materials');
    console.log(`\n  �S& Tabela materials: ${cols.length} colunas`);

    console.log('\n�"�"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"');
    console.log('�"   �S& BANCO DE DADOS PRONTO!                      �"');
    console.log('�"a�"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�\n');

  } finally {
    conn.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});

