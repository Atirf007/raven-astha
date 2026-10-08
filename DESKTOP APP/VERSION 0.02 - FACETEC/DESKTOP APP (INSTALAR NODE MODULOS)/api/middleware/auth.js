/* Auth Middleware — JWT verification */
const jwt = require('jsonwebtoken');
// IMPORTANT: Must match the secret used in auth.js to sign tokens
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-must-change-in-production-min32';

function authMiddleware(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    if (req.user && !req.user.org_id) {
      req.user.org_id = 'org_1';
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.', expired: true });
    }
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

module.exports = authMiddleware;
