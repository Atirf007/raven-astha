/* Auth Middleware — JWT verification */
const { verifyToken } = require('../security/tokens');
const { pool, readWithRetry } = require('../database/connection');
// IMPORTANT: Must match the secret used in auth.js to sign tokens

async function authMiddleware(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token || token.length > 4096) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }
  try {
    const decoded = verifyToken(token);
    if (!Number.isSafeInteger(decoded.id) || decoded.id < 1 || typeof decoded.org_id !== 'string' || !decoded.org_id) return res.status(401).json({ error: 'Sessão inválida' });
    let rows;
    try {
      [rows] = await readWithRetry(
        `SELECT u.id, u.email, u.role, u.org_id, u.is_active FROM sessions s
         JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.user_id = ?
         AND s.expires_at > NOW() AND u.is_active = 1 AND u.org_id = ? LIMIT 1`,
        [token, decoded.id, decoded.org_id]
      );
    } catch (_) { return res.status(503).json({ error: 'Não foi possível validar a sessão' }); }
    if (!rows.length || !rows[0].org_id || !rows[0].is_active) return res.status(401).json({ error: 'Sessão revogada' });
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.', expired: true });
    }
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

module.exports = authMiddleware;
