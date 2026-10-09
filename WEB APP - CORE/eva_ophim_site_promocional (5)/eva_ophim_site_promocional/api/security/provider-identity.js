const jwt = require('jsonwebtoken');
const crypto = require('crypto');
// Fixed endpoints only: caller-controlled URLs never reach fetch.
async function verifyIdentity(provider, token, expectedNonce) {
  if (typeof token !== 'string' || token.length > 16384) throw new Error('Invalid identity');
  let audience, issuer, endpoint;
  if (provider === 'google') {
    audience = process.env.GOOGLE_CLIENT_ID;
    issuer = ['https://accounts.google.com', 'accounts.google.com'];
    endpoint = 'https://www.googleapis.com/oauth2/v3/certs';
  } else if (provider === 'microsoft') {
    const tenant = process.env.AZURE_TENANT_ID;
    if (!/^[a-f0-9-]{36}$/i.test(tenant || '')) throw new Error('Provider not configured');
    audience = process.env.AZURE_CLIENT_ID;
    issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
    endpoint = `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`;
  } else throw new Error('Invalid provider');
  if (!audience || audience.includes('YOUR_')) throw new Error('Provider not configured');
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header.alg !== 'RS256' || typeof decoded.header.kid !== 'string' || decoded.header.kid.length > 200) throw new Error('Invalid identity');
  const response = await fetch(endpoint, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Provider unavailable');
  const text = await response.text();
  if (text.length > 128 * 1024) throw new Error('Invalid key response');
  const keys = JSON.parse(text).keys;
  if (!Array.isArray(keys)) throw new Error('Invalid key response');
  const jwk = keys.find(k => k.kid === decoded.header.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig'));
  if (!jwk) throw new Error('Invalid key');
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const claims = jwt.verify(token, key, { algorithms: ['RS256'], audience, issuer, maxAge: '1h', clockTolerance: 5 });
  if (expectedNonce !== undefined && (typeof expectedNonce !== 'string' || expectedNonce.length !== 43 || claims.nonce !== expectedNonce)) throw new Error('Invalid nonce');
  if (!claims.sub || !claims.exp || (provider === 'google' && claims.email_verified !== true)) throw new Error('Invalid identity');
  const email = claims.email || claims.preferred_username;
  if (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid identity');
  return { subject: claims.sub, email: email.toLowerCase().trim(), name: typeof claims.name === 'string' ? claims.name.slice(0,100) : email.split('@')[0] };
}
module.exports = { verifyIdentity };
