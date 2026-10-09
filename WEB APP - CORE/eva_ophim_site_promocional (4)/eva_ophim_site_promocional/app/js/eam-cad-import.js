(function (global) {
  'use strict';
  const formats = new Set(['step', 'stp', 'iges', 'igs']);
  const maxBytes = 8 * 1024 * 1024;
  const maxVertices = 1500000;
  const pending = [];
  let running = 0;

  function drain() {
    while (running < 2 && pending.length) {
      const job = pending.shift();
      running++;
      job.run().then(job.resolve, job.reject).finally(() => { running--; drain(); });
    }
  }

  function triangulate(buffer, format) {
    if (!formats.has(format) || !(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.byteLength > maxBytes) {
      return Promise.reject(new Error('Arquivo CAD inválido ou maior que 8 MiB'));
    }
    if (pending.length >= 32) return Promise.reject(new Error('Fila de conversão CAD cheia'));
    return new Promise((resolve, reject) => {
      pending.push({ resolve, reject, run: () => convert(buffer, format) });
      drain();
    });
  }

  function convert(buffer, format) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./js/eam-cad-worker.js');
      const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Conversão CAD excedeu o tempo permitido')); }, 60000);
      function finish(error, result) {
        clearTimeout(timeout);
        worker.terminate();
        if (error) reject(error); else resolve(result);
      }
      worker.onmessage = event => event.data?.error ? finish(new Error(event.data.error)) : finish(null, event.data?.result);
      worker.onerror = () => finish(new Error('Não foi possível iniciar a conversão CAD'));
      worker.postMessage({ buffer, format }, [buffer]);
    });
  }

  function buildGroup(result) {
    if (typeof THREE === 'undefined') throw new Error('Visualizador 3D indisponível');
    const group = new THREE.Group();
    let totalVertices = 0;
    for (const part of result.meshes || []) {
      const positions = part.attributes?.position?.array;
      const indices = part.index?.array;
      if (!Array.isArray(positions) || positions.length < 9 || positions.length % 3 || !positions.every(Number.isFinite)) continue;
      totalVertices += positions.length / 3;
      if (totalVertices > maxVertices) throw new Error('Modelo CAD excede o limite de geometria');
      if (indices && (!Array.isArray(indices) || !indices.every(index => Number.isSafeInteger(index) && index >= 0 && index < positions.length / 3))) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      if (indices) geometry.setIndex(indices);
      const normals = part.attributes?.normal?.array;
      if (Array.isArray(normals) && normals.length === positions.length && normals.every(Number.isFinite)) {
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      } else geometry.computeVertexNormals();
      const color = Array.isArray(part.color) && part.color.length >= 3 && part.color.slice(0, 3).every(Number.isFinite)
        ? new THREE.Color(part.color[0], part.color[1], part.color[2]) : new THREE.Color(0x8fa3b9);
      group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.65, side: THREE.DoubleSide })));
    }
    if (!group.children.length) throw new Error('O arquivo CAD não contém geometria válida');
    return group;
  }

  global.EamCadImport = { parse: (buffer, format) => triangulate(buffer, format).then(buildGroup) };
})(window);
