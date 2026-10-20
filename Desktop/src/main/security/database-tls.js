const fs = require('fs');
function databaseTLS(env = process.env) {
  const local = ['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST);
  if (local && env.DB_SSL_REQUIRED !== 'true') return {};
  if (!local && require('net').isIP(env.DB_HOST)) throw new Error('DB_HOST remoto deve ser um nome DNS correspondente ao certificado TLS');
  // Never fall back to plaintext or disable certificate verification for a remote DB.
  const ssl = { rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' };
  if (env.DB_SSL_CA_FILE) ssl.ca = fs.readFileSync(env.DB_SSL_CA_FILE, 'utf8');
  return { ssl };
}
module.exports = databaseTLS;
