const crypto = require('node:crypto');
const pending = new Map();
const lifetime = 5 * 60 * 1000;

function clientId() {
  const value = process.env.GOOGLE_CLIENT_ID || '';
  return /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value) ? value : null;
}
function issue() {
  const now = Date.now();
  for (const [key, expiry] of pending) if (expiry <= now) pending.delete(key);
  if (pending.size >= 1000) return null;
  const nonce = crypto.randomBytes(32).toString('base64url');
  pending.set(nonce, now + lifetime);
  return nonce;
}
function consume(nonce) {
  if (typeof nonce !== 'string') return false;
  const expiry = pending.get(nonce);
  pending.delete(nonce);
  return typeof expiry === 'number' && expiry > Date.now();
}
module.exports = { clientId, issue, consume };
