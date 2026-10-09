/* CAD parsing runs outside the UI thread; only local, version-pinned assets are loaded. */
importScripts('../vendor/occt-import-js/occt-import-js.js');

let enginePromise;
self.onmessage = async function (event) {
  const { buffer, format } = event.data || {};
  try {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > 8 * 1024 * 1024 || !['step', 'stp', 'iges', 'igs'].includes(format)) {
      throw new Error('Arquivo CAD inválido ou maior que 8 MiB');
    }
    if (!enginePromise) {
      enginePromise = occtimportjs({
        locateFile(name) { return new URL('../vendor/occt-import-js/' + name, self.location.href).href; }
      });
    }
    const engine = await enginePromise;
    const bytes = new Uint8Array(buffer);
    const result = format === 'iges' || format === 'igs' ? engine.ReadIgesFile(bytes, null) : engine.ReadStepFile(bytes, null);
    if (!result || !result.success || !Array.isArray(result.meshes) || !result.meshes.length) throw new Error('O arquivo CAD não contém sólidos renderizáveis');
    let vertices = 0;
    for (const mesh of result.meshes) {
      vertices += (mesh.attributes?.position?.array?.length || 0) / 3;
      if (vertices > 1500000) throw new Error('Modelo CAD excede o limite de geometria');
    }
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error.message || 'Falha ao converter o arquivo CAD' });
  }
};
