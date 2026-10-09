function validateProfile(body) {
  const cover = body?.cover_image;
  if (cover !== null && (typeof cover !== 'string' || cover.length > 400000)) throw new Error('Capa inválida ou grande demais.');
  if (cover) {
    const match = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=]+)$/i.exec(cover);
    if (!match) throw new Error('Use PNG, JPG ou WebP para a capa.');
    const bytes = Buffer.from(match[2], 'base64');
    const signatures = {
      png: bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
      jpeg: bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
      webp: bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    };
    if (!bytes.length || !signatures[match[1].toLowerCase()]) throw new Error('Arquivo de capa inválido.');
  }
  if (!Array.isArray(body.links) || body.links.length > 12) throw new Error('Cadastre até 12 links.');
  const links = body.links.map(link => {
    if (typeof link?.label !== 'string' || !link.label.trim() || link.label.trim().length > 60 || typeof link.url !== 'string' || link.url.length > 2048) throw new Error('Informe nome e endereço válidos para cada link.');
    let url;
    try { url = new URL(link.url.trim()); } catch (_) { throw new Error('Endereço de link inválido.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use links HTTP ou HTTPS sem credenciais no endereço.');
    return { label: link.label.trim(), url: url.href };
  });
  return { cover_image: cover || null, links };
}
module.exports = { validateProfile };
