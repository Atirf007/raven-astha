const jwt = require('jsonwebtoken');
const crypto = require('crypto');
function secret() {
  const value = process.env.JWT_SECRET;
  if (typeof value !== 'string' || value.length < 32 || /change.this|dev-only|YOUR_|placeholder/i.test(value)) throw new Error('JWT_SECRET must contain at least 32 random characters');
  return value;
}
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, org_id: user.org_id }, secret(), {
    algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '8h', jwtid: crypto.randomUUID()
  });
}
function verifyToken(token) { return jwt.verify(token, secret(), { algorithms: ['HS256'] }); }
function expiresAt(token) { return new Date(verifyToken(token).exp * 1000); }
module.exports = { secret, signToken, verifyToken, expiresAt };
