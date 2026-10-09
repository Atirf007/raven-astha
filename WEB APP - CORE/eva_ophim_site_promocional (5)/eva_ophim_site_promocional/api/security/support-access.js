// Tenant administrators are not platform support operators. Default: no global access.
function supportAccess(req, res, next) {
  let identities;
  try { identities = JSON.parse(process.env.SUPPORT_ADMIN_IDENTITIES || '[]'); } catch { identities = []; }
  const allowed = Array.isArray(identities) && identities.some(identity =>
    identity && typeof identity.org_id === 'string' && Number.isSafeInteger(identity.user_id)
    && identity.org_id === req.user?.org_id && identity.user_id === req.user?.id);
  if (!allowed) return res.status(403).json({ error: 'Sem permissão para atendimento global' });
  next();
}
module.exports = supportAccess;
