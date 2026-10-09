// Supplementary rejection of unmistakable attack payloads. Authorization,
// parameterized SQL and context-aware output encoding remain the security boundary.
const attack = /<\s*(?:script|iframe|object|embed)\b|<[^>]{0,2048}\bon\w+\s*=|(?:javascript|vbscript)\s*:|\bunion\s+(?:all\s+)?select\b|;\s*(?:drop|truncate|alter)\s+(?:table|database)\b|['"]\s*(?:or|and)\s+['"]?1['"]?\s*=\s*['"]?1|\b(?:sleep|benchmark)\s*\(/i;
function attackGuard(req, res, next) {
  let count = 0;
  function inspect(value, depth = 0, key = '') {
    if (++count > 20000 || depth > 30) return true;
    if (typeof value === 'string') {
      // Passwords are opaque credentials; do not normalize or censor them.
      if (['password', 'current_password', 'new_password'].includes(key)) return false;
      return attack.test(value);
    }
    if (!value || typeof value !== 'object') return false;
    return Object.keys(value).some(k => ['__proto__', 'constructor', 'prototype'].includes(k) || inspect(value[k], depth + 1, k));
  }
  if (inspect(req.body) || inspect(req.query)) return res.status(400).json({ error: 'Conteúdo não permitido. Confira os campos enviados.' });
  next();
}
module.exports = attackGuard;
