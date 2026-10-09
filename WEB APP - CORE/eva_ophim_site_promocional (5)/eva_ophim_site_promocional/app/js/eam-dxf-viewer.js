(function (root) {
  'use strict';
  const MAX_BYTES = 8 * 1024 * 1024;
  const MAX_ENTITIES = 50000;
  const numeric = value => {
    const number = Number(value);
    return Number.isFinite(number) && Math.abs(number) <= 1e9 ? number : null;
  };
  function parseDxf(source) {
    if (typeof source !== 'string' || source.length > MAX_BYTES) throw new Error('DXF excede o limite de pré-visualização');
    const lines = source.replace(/\r/g, '').split('\n');
    const entities = [];
    let section = '', current = null, pendingSection = false, ignored = 0;
    function finish() {
      if (!current) return;
      const groups = current.groups;
      const first = code => numeric(groups.find(group => group[0] === code)?.[1]);
      const value = code => groups.find(group => group[0] === code)?.[1];
      const entity = { type: current.type };
      if (current.type === 'LINE') {
        entity.points = [[first(10), first(20)], [first(11), first(21)]];
      } else if (current.type === 'LWPOLYLINE') {
        entity.points = [];
        let x = null;
        groups.forEach(([code, raw]) => {
          if (code === 10) x = numeric(raw);
          if (code === 20 && x !== null) { entity.points.push([x, numeric(raw)]); x = null; }
        });
        entity.closed = Boolean((Number(value(70)) || 0) & 1);
      } else if (current.type === 'CIRCLE' || current.type === 'ARC') {
        entity.center = [first(10), first(20)];
        entity.radius = first(40);
        entity.start = first(50);
        entity.end = first(51);
      } else if (current.type === 'TEXT' || current.type === 'MTEXT') {
        entity.points = [[first(10), first(20)]];
        entity.label = String(value(1) || '').slice(0, 200);
        entity.height = first(40) || 2;
      } else { ignored++; current = null; return; }
      const coords = [...(entity.points || []), ...(entity.center ? [entity.center] : [])];
      if (coords.some(point => point.some(coordinate => coordinate === null)) ||
          (entity.radius !== undefined && (entity.radius === null || entity.radius <= 0)) ||
          (entity.points && entity.points.length < (entity.type === 'LWPOLYLINE' ? 2 : 1))) ignored++;
      else entities.push(entity);
      current = null;
    }
    for (let index = 0; index + 1 < lines.length; index += 2) {
      const code = Number(lines[index].trim()), value = lines[index + 1].trim();
      if (!Number.isInteger(code)) continue;
      if (pendingSection) { section = code === 2 ? value : ''; pendingSection = false; continue; }
      if (code === 0 && value === 'SECTION') { finish(); pendingSection = true; continue; }
      if (code === 0 && value === 'ENDSEC') { finish(); section = ''; continue; }
      if (section !== 'ENTITIES') continue;
      if (code === 0) {
        finish();
        if (entities.length + ignored >= MAX_ENTITIES) throw new Error('DXF contém entidades demais');
        current = { type: value, groups: [] };
      } else if (current) current.groups.push([code, value]);
    }
    finish();
    if (!entities.length) throw new Error('DXF sem entidades 2D compatíveis para pré-visualização');
    return { entities, ignored };
  }
  function render(container, parsed) {
    const toolbar = document.createElement('div'), canvas = document.createElement('canvas'), info = document.createElement('span');
    toolbar.className = 'eam-dxf-toolbar'; canvas.className = 'eam-dxf-canvas';
    let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    function include(x, y) { bounds.minX = Math.min(bounds.minX, x); bounds.minY = Math.min(bounds.minY, y); bounds.maxX = Math.max(bounds.maxX, x); bounds.maxY = Math.max(bounds.maxY, y); }
    parsed.entities.forEach(entity => {
      (entity.points || []).forEach(point => include(...point));
      if (entity.center) {
        include(entity.center[0] - entity.radius, entity.center[1] - entity.radius);
        include(entity.center[0] + entity.radius, entity.center[1] + entity.radius);
      }
    });
    let zoom = 1, offsetX = 0, offsetY = 0, measuring = false, measureStart = null, measureEnd = null, dragging = false, lastPoint = null;
    const width = () => canvas.clientWidth || 800, height = () => canvas.clientHeight || 500;
    const baseScale = () => Math.min((width() - 40) / Math.max(bounds.maxX - bounds.minX, 1), (height() - 40) / Math.max(bounds.maxY - bounds.minY, 1));
    const centerX = (bounds.minX + bounds.maxX) / 2, centerY = (bounds.minY + bounds.maxY) / 2;
    const screen = ([x, y]) => [width() / 2 + offsetX + (x - centerX) * baseScale() * zoom, height() / 2 + offsetY - (y - centerY) * baseScale() * zoom];
    const world = (x, y) => [centerX + (x - width() / 2 - offsetX) / (baseScale() * zoom), centerY - (y - height() / 2 - offsetY) / (baseScale() * zoom)];
    function paint() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width() * ratio); canvas.height = Math.round(height() * ratio);
      const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width(), height());
      ctx.strokeStyle = '#233f60'; ctx.fillStyle = '#233f60'; ctx.lineWidth = 1.4;
      parsed.entities.forEach(entity => {
        if (entity.type === 'LINE' || entity.type === 'LWPOLYLINE') {
          ctx.beginPath(); entity.points.forEach((point, index) => { const [x, y] = screen(point); if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
          if (entity.closed) ctx.closePath(); ctx.stroke();
        } else if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
          const [x, y] = screen(entity.center), radius = entity.radius * baseScale() * zoom;
          ctx.beginPath();
          if (entity.type === 'CIRCLE') ctx.arc(x, y, radius, 0, Math.PI * 2);
          else ctx.arc(x, y, radius, -(entity.start || 0) * Math.PI / 180, -(entity.end || 0) * Math.PI / 180, true);
          ctx.stroke();
        } else if (entity.label) {
          const [x, y] = screen(entity.points[0]); ctx.font = `${Math.max(10, Math.min(30, entity.height * baseScale() * zoom))}px sans-serif`; ctx.fillText(entity.label, x, y);
        }
      });
      if (measureStart && measureEnd) {
        const a = screen(measureStart), b = screen(measureEnd);
        ctx.strokeStyle = '#d73c33'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
        const distance = Math.hypot(measureEnd[0] - measureStart[0], measureEnd[1] - measureStart[1]);
        info.textContent = `Distância: ${distance.toFixed(2)} unidades do desenho`;
      } else info.textContent = parsed.ignored ? `${parsed.ignored} entidade(s) fora da prévia 2D` : 'Arraste para mover; use a roda para aproximar';
    }
    function control(label, action) { const item = document.createElement('button'); item.type = 'button'; item.textContent = label; item.addEventListener('click', action); toolbar.append(item); return item; }
    control('−', () => { zoom = Math.max(.1, zoom / 1.25); paint(); });
    control('+', () => { zoom = Math.min(100, zoom * 1.25); paint(); });
    control('Ajustar', () => { zoom = 1; offsetX = 0; offsetY = 0; paint(); });
    const measureButton = control('Medir', () => { measuring = !measuring; measureStart = null; measureEnd = null; measureButton.classList.toggle('active', measuring); paint(); });
    toolbar.append(info); container.replaceChildren(toolbar, canvas);
    canvas.addEventListener('wheel', event => { event.preventDefault(); zoom = Math.max(.1, Math.min(100, zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15))); paint(); }, { passive: false });
    canvas.addEventListener('pointerdown', event => { canvas.setPointerCapture(event.pointerId); dragging = !measuring; lastPoint = [event.clientX, event.clientY]; if (measuring) { const rect = canvas.getBoundingClientRect(), point = world(event.clientX - rect.left, event.clientY - rect.top); if (!measureStart || measureEnd) { measureStart = point; measureEnd = null; } else measureEnd = point; paint(); } });
    canvas.addEventListener('pointermove', event => { if (!dragging || !lastPoint) return; offsetX += event.clientX - lastPoint[0]; offsetY += event.clientY - lastPoint[1]; lastPoint = [event.clientX, event.clientY]; paint(); });
    canvas.addEventListener('pointerup', () => { dragging = false; lastPoint = null; });
    const observer = new ResizeObserver(paint); observer.observe(canvas);
    paint(); return () => observer.disconnect();
  }
  const api = { parseDxf, render, MAX_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EamDxfViewer = api;
})(typeof window === 'undefined' ? null : window);
