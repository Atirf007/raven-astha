const path = require('node:path');
const MAX_BYTES = 10 * 1024 * 1024;
function safeUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function validateAttachment(input) {
  const { filename, file_data, file_url } = input;
  if (typeof filename !== 'string' || filename.length > 200 || /[\x00-\x1f\x7f/\\]/.test(filename)) throw Error('Arquivo inválido');
  if (Boolean(file_data) === Boolean(file_url)) throw Error('Informe dados ou URL');
  if (file_url) {
    const url = safeUrl(file_url);
    if (!url) throw Error('URL inválida');
    return { filename, file_url: url, file_data: null, mime_type: 'application/octet-stream', size: null };
  }
  if (typeof file_data !== 'string' || file_data.length > Math.ceil(MAX_BYTES / 3) * 4 + 200) throw Error('Arquivo excede limite');
  const raw = file_data.startsWith('data:') ? file_data.slice(file_data.indexOf(',') + 1) : file_data;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)) throw Error('Base64 inválido');
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length || buf.length > MAX_BYTES) throw Error('Tamanho inválido');
  const ext = path.extname(filename).toLowerCase();
  const text = buf.toString('utf8');
  let mime = 'application/octet-stream', valid = false;
  switch (ext) {
    case '.pdf': mime = 'application/pdf'; valid = text.startsWith('%PDF-'); break;
    case '.png': mime = 'image/png'; valid = buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])); break;
    case '.jpg': case '.jpeg': mime = 'image/jpeg'; valid = buf[0]===255 && buf[1]===216 && buf[2]===255; break;
    case '.webp': mime='image/webp'; valid=text.startsWith('RIFF') && text.slice(8,12)==='WEBP'; break;
    case '.glb': mime='model/gltf-binary'; valid=buf.length>=12 && text.startsWith('glTF') && buf.readUInt32LE(4)===2 && buf.readUInt32LE(8)===buf.length; break;
    case '.gltf':
      mime='model/gltf+json';
      try { const data=JSON.parse(text); valid=data && data.asset && data.asset.version==='2.0';
        // External fetches in glTF are unnecessary for self-contained uploads.
        const resources=[...(data.buffers||[]),...(data.images||[])];
        valid=valid && resources.every(r=>!r.uri || (typeof r.uri==='string' && /^data:(?:application\/octet-stream|application\/gltf-buffer|image\/(?:png|jpeg|webp));base64,[A-Za-z0-9+/=]+$/.test(r.uri)));
      } catch {} break;
    case '.stl': valid=(buf.length>=84 && 84+buf.readUInt32LE(80)*50===buf.length) || (/^\s*solid\b/i.test(text) && /\bendsolid\b/i.test(text) && /\bfacet\s+normal\b/i.test(text)); break;
    case '.obj': valid=/^v\s+-?[\d.]+\s+-?[\d.]+\s+-?[\d.]+/m.test(text) && !/<|\x00/.test(text); break;
    case '.mtl': valid=/^newmtl\s+\S+/m.test(text) && !/<|\x00/.test(text); break;
    case '.3ds': valid=buf.length>=6 && buf.readUInt16LE(0)===0x4d4d && buf.readUInt32LE(2)===buf.length; break;
    case '.dwg': valid=/^AC10\d{2}/.test(text); break;
    case '.dxf': valid=/^\s*0\s*\r?\nSECTION\s*\r?\n/m.test(text) && /\r?\nEOF\s*$/.test(text); break;
    case '.step': case '.stp': valid=/^\s*ISO-10303-21;/.test(text) && /END-ISO-10303-21;\s*$/.test(text); break;
    case '.iges': case '.igs': valid=/^.{72}S\s*1\s*$/m.test(text) && /^.{72}T\s*1\s*$/m.test(text); break;
  }
  if (!valid) throw Error('Tipo ou conteúdo não permitido');
  return { filename, mime_type: mime, file_data: raw, file_url: null, size: Math.ceil(buf.length/1024) };
}
module.exports = { validateAttachment, safeUrl, MAX_BYTES };
