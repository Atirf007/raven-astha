const auth = require('./auth');
const { pool } = require('../database/connection');

// Groups narrow existing access for assigned non-admin members; they never elevate role checks.
module.exports = (resource, { action: fixedAction } = {}) => {
 if(fixedAction!==undefined&&!['read','write'].includes(fixedAction))throw Error('Invalid fixed group action');
 return [auth, async (req, res, next) => {
  if (['admin', 'superadmin'].includes(req.user?.role)) return next();
  const action = fixedAction || (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? 'read' : 'write');
  try {
    const [rows] = await pool.execute(`SELECT g.permissions FROM org_access_groups g
      JOIN org_access_group_members m ON m.group_id=g.id AND m.org_id=g.org_id
      WHERE m.org_id=? AND m.user_id=?`, [req.user.org_id, req.user.id]);
    if (!rows.length) return next(); // Preserve legacy access until a group is explicitly assigned.
    for (const row of rows) {
      const grants = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
      if (grants?.[resource]?.[action]) return next();
    }
    return res.status(403).json({ error: 'Seu grupo não permite esta operação.' });
  } catch (_) {
    return res.status(503).json({ error: 'Não foi possível verificar as permissões do grupo.' });
  }
}];
};
