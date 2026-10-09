const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../security/tokens');

// Signature verification identifies a quota; route middleware still validates
// the live session and authorizes every operation independently.
function quotaIdentity(req) {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ') && header.length <= 4103) {
    try {
      const identity = verifyToken(header.slice(7));
      if (Number.isSafeInteger(identity.id) && identity.id > 0 && typeof identity.org_id === 'string' && identity.org_id.length <= 50 && identity.org_id) {
        return `user:${JSON.stringify([identity.org_id, identity.id])}`;
      }
    } catch (_) { /* Invalid credentials share the anonymous network quota. */ }
  }
  return null;
}
function applicationRateLimit({ readLimit = 240, writeLimit = 60, anonymousLimit = 60, windowMs = 60000 } = {}) {
  const options = {
    windowMs, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => req.applicationQuota || req.ip,
    message: { error: 'Limite de requisições excedido. Aguarde o tempo indicado e tente novamente.' }
  };
  const reads = rateLimit({ ...options, max: readLimit });
  const writes = rateLimit({ ...options, max: writeLimit });
  const anonymous = rateLimit({ ...options, max: anonymousLimit });
  return (req, res, next) => {
    req.applicationQuota = quotaIdentity(req);
    if (!req.applicationQuota) return anonymous(req, res, next);
    return ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? reads(req, res, next) : writes(req, res, next);
  };
}
module.exports = { applicationRateLimit, quotaIdentity };
