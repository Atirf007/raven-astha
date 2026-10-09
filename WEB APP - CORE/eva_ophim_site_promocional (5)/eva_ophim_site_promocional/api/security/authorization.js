const ROLES = ['superadmin', 'admin', 'manager', 'operator', 'viewer'];
function requireRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Sem permissão' });
}
function validRoleChange(actor, target, requested) {
  if (!ROLES.includes(requested)) return false;
  if (actor.role === 'superadmin') return true;
  return actor.role === 'admin' && target.role !== 'superadmin' && requested !== 'superadmin';
}
module.exports = { ROLES, requireRoles, validRoleChange };
