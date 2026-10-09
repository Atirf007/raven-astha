'use strict';

// Deployment configuration contains an origin, never credentials or a token.
function desktopServer(value) {
  if (value === undefined || value === '') return { url: 'http://localhost:3000', local: true };
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Endereço do servidor inválido.');
  let target;
  try { target = new URL(value); } catch { throw new Error('Endereço do servidor inválido.'); }
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash || target.pathname !== '/') {
    throw new Error('Configure apenas a origem HTTPS do servidor, sem credenciais, caminho ou parâmetros.');
  }
  return { url: target.origin, local: false };
}
module.exports = { desktopServer };
