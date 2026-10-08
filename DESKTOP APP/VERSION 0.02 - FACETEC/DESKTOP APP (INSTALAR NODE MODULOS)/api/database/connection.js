// database/connection.js
require('dotenv').config(); // Redundância arquitetural para forçar a alocação de escopo local
const mysql = require('mysql2/promise');

// ── Auditoria de Vazamento de Escopo (Stress Test Interno) ──
if (!process.env.DB_HOST || !process.env.DB_PASSWORD) {
    console.error('\n[ERRO FATAL - KERNEL] O interpretador Node.js não localizou as variáveis de ambiente.');
    console.error('Causa-Raiz 1: O arquivo .env não está salvo na raiz da pasta "api".');
    console.error('Causa-Raiz 2: O arquivo .env foi salvo incorretamente com extensão oculta (ex: .env.txt).');
    console.error('Causa-Raiz 3: Variáveis declaradas com erros de sintaxe ou espaços indesejados.\n');
    process.exit(1); // Abort signal acionado para impedir o direcionamento anômalo para localhost
}

// ── Instanciação Imutável do Pool TCP (MySQL 8.x) ──
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
});

// ── Método de Homologação de Handshake ──
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        connection.release(); // Liberação estrita de recursos (I/O)
        return true;
    } catch (error) {
        console.error(`[DB_CRASH] Exceção mapeada na camada de transporte SGBD: ${error.message}`);
        return false;
    }
}

// Exportação unificada dos módulos
module.exports = { pool, testConnection };
