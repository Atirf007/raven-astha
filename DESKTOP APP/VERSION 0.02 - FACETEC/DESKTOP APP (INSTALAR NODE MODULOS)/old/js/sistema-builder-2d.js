/* ============================================================
   Sistema Builder 2D — Premium CAD Editor (v4 - Full Rewrite)
   ============================================================ */

let cadCanvas, ctx;
let blueprint = {
  floors: {
    0: { walls: [], doors: [], windows: [], pillars: [], shelves: [], stairs: [], zones: [], paths: [] },
    1: { walls: [], doors: [], windows: [], pillars: [], shelves: [], stairs: [], zones: [], paths: [] }
  }
};
let currentFloor = 0;
let cadTool = 'select';
let cadViewMode = '2d';

// Navigation State
let zoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// Drawing State
let isDrawing = false;
let startX = 0, startY = 0;
let tempWall = null;
let tempZone = null;
let tempPath = null;
let hoveredItem = null;
let selectedItem = null;
let highlightedSlotId = null;

// Interaction State
let dragAction = null;  // 'move' | 'resize' | null
let dragHandle = null;  // 'tl','tr','bl','br','top','bottom','left','right','p1','p2','move'
let dragItemRef = null; // direct reference to the item object being dragged
let dragStartBox = null; // snapshot of item at drag start
let dragStartMouse = null; // {x,y} world coords at drag start

// Configs
const GRID_SIZE = 20;

window.checkOverlap = function(newItem, type) {
  const floor = blueprint.floors[currentFloor];
  const arr = floor[window.getArrayName(type)];
  if(!arr) return false;
  for(let i=0; i<arr.length; i++) {
    const item = arr[i];
    if (type === 'wall' || type === 'stairs' || type === 'path') {
      // Line items: check both directions
      if (item.x1 === newItem.x1 && item.y1 === newItem.y1 && item.x2 === newItem.x2 && item.y2 === newItem.y2) return true;
      if (item.x1 === newItem.x2 && item.y1 === newItem.y2 && item.x2 === newItem.x1 && item.y2 === newItem.y1) return true;
    } else if (type === 'pillar') {
      // Pillars overlap if at exact same position
      if (item.x === newItem.x && item.y === newItem.y) return true;
    } else if (type === 'shelf' || type === 'zone') {
      // Rect items: overlap if at exact same position AND size
      if (item.x === newItem.x && item.y === newItem.y && item.w === newItem.w && item.h === newItem.h) return true;
    } else {
      // door, window: overlap only if at exactly the same position
      if (item.x === newItem.x && item.y === newItem.y) return true;
    }
  }
  return false;
}

// Ensure every floor in blueprint has all required arrays
function ensureFloorArrays() {
  const requiredArrays = ['walls', 'doors', 'windows', 'pillars', 'shelves', 'stairs', 'zones', 'paths'];
  if (!blueprint.floors) blueprint.floors = {};
  Object.keys(blueprint.floors).forEach(key => {
    const f = blueprint.floors[key];
    requiredArrays.forEach(arr => {
      if (!Array.isArray(f[arr])) f[arr] = [];
    });
  });
  // Ensure at least floor 0 exists
  if (!blueprint.floors[0]) {
    blueprint.floors[0] = { walls: [], doors: [], windows: [], pillars: [], shelves: [], stairs: [], zones: [], paths: [] };
  }
}

window.initWarehouseMap = async function() {
  const layoutRes = await API.get('/warehouse/layout');
  if (layoutRes.success) {
    if (layoutRes.data && layoutRes.data.blueprint_data && layoutRes.data.blueprint_data.floors) {
      blueprint = layoutRes.data.blueprint_data;
    }
    
    // CRITICAL: ensure all arrays exist after loading from API
    ensureFloorArrays();
    
    cadCanvas = document.getElementById('cadCanvas2d');
    ctx = cadCanvas.getContext('2d');
    
    // Center initially — use the canvas's own container (50% of workspace)
    const cadParent = cadCanvas.parentElement;
    panX = cadParent.clientWidth / 2 - 400;
    panY = cadParent.clientHeight / 2 - 300;
    
    resizeCadCanvas();
    window.addEventListener('resize', resizeCadCanvas);
    
    setupCadEvents();
    renderCad();
    
    if (typeof initCad3D === 'function') {
      window._cadFrameCamera3D = true; // Frame camera to existing items on load
      initCad3D(blueprint);
    }
  }
}

window.resizeCadCanvas = function() {
  if(!cadCanvas) return;
  // Use the canvas's own CSS-rendered size (its parent div is 50% wide)
  const rect = cadCanvas.getBoundingClientRect();
  const w = rect.width || cadCanvas.parentElement.clientWidth;
  const h = rect.height || cadCanvas.parentElement.clientHeight;
  cadCanvas.width = w;
  cadCanvas.height = h;
  renderCad();
}

// ── UI Controls ──
window.setCadTool = function(tool) {
  if (tool === 'shelf') {
    const centerX = (cadCanvas.width / 2 - panX) / zoom;
    const centerY = (cadCanvas.height / 2 - panY) / zoom;
    window.pendingShelfPos = { 
      sx: Math.round(centerX / GRID_SIZE) * GRID_SIZE, 
      sy: Math.round(centerY / GRID_SIZE) * GRID_SIZE 
    };
    
    document.getElementById('modal-cad-shelf').style.display = 'flex';
    
    // Bind the save button so it actually creates the shelf!
    document.getElementById('btn-save-shelf').onclick = function() {
      const id = document.getElementById('shelf-id').value || 'SH-UNDEF';
      const levels = parseInt(document.getElementById('shelf-levels').value) || 3;
      const positions = parseInt(document.getElementById('shelf-positions').value) || 4;
      const width = parseInt(document.getElementById('shelf-width').value) || 100;
      const depth = parseInt(document.getElementById('shelf-depth').value) || 40;
      
      const floor = blueprint.floors[currentFloor];
      if (!floor.shelves) floor.shelves = [];
      const arr = floor.shelves;
      
      arr.push({ 
        id: id, 
        x: window.pendingShelfPos.sx, 
        y: window.pendingShelfPos.sy, 
        w: width, 
        h: depth, 
        levels: levels, 
        positions: positions, 
        angle: 0 
      });
      
      document.getElementById('modal-cad-shelf').style.display = 'none';
      
      // Select the new item instantly
      selectedItem = { type: 'shelf', index: arr.length - 1 };
      cadTool = 'select';
      document.querySelectorAll('.cad-tool').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === 'select');
      });
      
      saveHistory(); 
      renderCad(); 
      window._cadFrameCamera3D = true; // Frame camera to new shelf
      if (typeof update3DScene === 'function') update3DScene();
    };
    
    cadTool = 'select';
    document.querySelectorAll('.cad-tool').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === 'select');
    });
    return;
  }

  cadTool = tool;
  document.querySelectorAll('.cad-tool').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  
  if (tool !== 'select') {
    selectedItem = null;
  }
  renderCad();
}

window.changeCadFloor = function(floorLevel) {
  currentFloor = parseInt(floorLevel);
  if (!blueprint.floors[currentFloor]) {
    blueprint.floors[currentFloor] = { walls: [], doors: [], windows: [], pillars: [], shelves: [], stairs: [], zones: [], paths: [] };
  }
  renderCad();
  if (typeof update3DScene === 'function') update3DScene();
}

window.highlightSlot2D = function(slotId) {
  highlightedSlotId = slotId;
  renderCad();
  setTimeout(() => {
    if(highlightedSlotId === slotId) {
      highlightedSlotId = null;
      renderCad();
    }
  }, 20000);
}

// ── Coordinate Helpers ──
function getMousePos(e) {
  const rect = cadCanvas.getBoundingClientRect();
  const scaleX = cadCanvas.width / rect.width;
  const scaleY = cadCanvas.height / rect.height;
  
  const rawX = (e.clientX - rect.left) * scaleX;
  const rawY = (e.clientY - rect.top) * scaleY;
  
  // Convert screen to world
  const x = (rawX - panX) / zoom;
  const y = (rawY - panY) / zoom;
  
  // Snap to grid
  const sx = Math.round(x / GRID_SIZE) * GRID_SIZE;
  const sy = Math.round(y / GRID_SIZE) * GRID_SIZE;
  
  return { rawX, rawY, x, y, sx, sy };
}

// ── Get the actual data object for a selectedItem descriptor ──
function getItemData(sel) {
  if (!sel) return null;
  const floor = blueprint.floors[currentFloor];
  const arr = floor[window.getArrayName(sel.type)];
  if (!arr || !arr[sel.index]) return null;
  return arr[sel.index];
}

// ── Hit Testing ──
function dist2(ax, ay, bx, by) { return (ax-bx)*(ax-bx) + (ay-by)*(ay-by); }

function hitTestHandles(x, y, itemData, itemType, itemIndex) {
  if (!itemData) return null;
  const hs = 20 / zoom; // handle size in world coords
  if (itemData.w !== undefined) {
    // Rectangle-based item (shelf, zone with w/h)
    const ix = itemData.x, iy = itemData.y, iw = itemData.w, ih = itemData.h;
    
    // Corner handles
    if (Math.abs(x - ix) < hs && Math.abs(y - iy) < hs) return { type: itemType, index: itemIndex, handle: 'tl' };
    if (Math.abs(x - (ix + iw)) < hs && Math.abs(y - iy) < hs) return { type: itemType, index: itemIndex, handle: 'tr' };
    if (Math.abs(x - ix) < hs && Math.abs(y - (iy + ih)) < hs) return { type: itemType, index: itemIndex, handle: 'bl' };
    if (Math.abs(x - (ix + iw)) < hs && Math.abs(y - (iy + ih)) < hs) return { type: itemType, index: itemIndex, handle: 'br' };
    
    // Edge handles
    if (Math.abs(x - (ix + iw/2)) < hs && Math.abs(y - iy) < hs) return { type: itemType, index: itemIndex, handle: 'top' };
    if (Math.abs(x - (ix + iw/2)) < hs && Math.abs(y - (iy + ih)) < hs) return { type: itemType, index: itemIndex, handle: 'bottom' };
    if (Math.abs(x - ix) < hs && Math.abs(y - (iy + ih/2)) < hs) return { type: itemType, index: itemIndex, handle: 'left' };
    if (Math.abs(x - (ix + iw)) < hs && Math.abs(y - (iy + ih/2)) < hs) return { type: itemType, index: itemIndex, handle: 'right' };
    
    // Body (move)
    if (x >= ix && x <= ix + iw && y >= iy && y <= iy + ih) return { type: itemType, index: itemIndex, handle: 'move' };
    
  } else if (itemData.x1 !== undefined) {
    // Line-based item (wall, stairs, path)
    if (Math.abs(x - itemData.x1) < hs && Math.abs(y - itemData.y1) < hs) return { type: itemType, index: itemIndex, handle: 'p1' };
    if (Math.abs(x - itemData.x2) < hs && Math.abs(y - itemData.y2) < hs) return { type: itemType, index: itemIndex, handle: 'p2' };
    
    const l2 = dist2(itemData.x1, itemData.y1, itemData.x2, itemData.y2);
    if (l2 > 0) {
      let t = ((x - itemData.x1) * (itemData.x2 - itemData.x1) + (y - itemData.y1) * (itemData.y2 - itemData.y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const px = itemData.x1 + t * (itemData.x2 - itemData.x1);
      const py = itemData.y1 + t * (itemData.y2 - itemData.y1);
      const d = Math.sqrt(dist2(x, y, px, py));
      if (d < 15/zoom) return { type: itemType, index: itemIndex, handle: 'move' };
    }
  } else {
    // Point-based items (doors, windows, pillars)
    if (Math.hypot(x - itemData.x, y - itemData.y) < 20/zoom) return { type: itemType, index: itemIndex, handle: 'move' };
  }
  return null;
}

function getHoveredItem(x, y) {
  const floor = blueprint.floors[currentFloor];
  
  // PRIORITY 1: If there's a selected item, check its handles first
  if (selectedItem) {
    const selData = getItemData(selectedItem);
    if (selData) {
      const handleHit = hitTestHandles(x, y, selData, selectedItem.type, selectedItem.index);
      if (handleHit) return handleHit;
    }
  }
  
  // PRIORITY 2: Normal item body hit testing
  const hitToler = 25/zoom;
  
  // Point items first (small targets)
  if(floor.doors) {
    for (let i = 0; i < floor.doors.length; i++) {
      if (Math.hypot(x - floor.doors[i].x, y - floor.doors[i].y) < hitToler) return { type: 'door', index: i };
    }
  }
  if(floor.windows) {
    for (let i = 0; i < floor.windows.length; i++) {
      if (Math.hypot(x - floor.windows[i].x, y - floor.windows[i].y) < hitToler) return { type: 'window', index: i };
    }
  }
  if(floor.pillars) {
    for (let i = 0; i < floor.pillars.length; i++) {
      const pil = floor.pillars[i];
      if (Math.abs(x - pil.x) < pil.size/2 + 5 && Math.abs(y - pil.y) < pil.size/2 + 5) return { type: 'pillar', index: i };
    }
  }
  // Shelves (rectangle)
  if(floor.shelves) {
    for (let i = floor.shelves.length - 1; i >= 0; i--) {
      const sh = floor.shelves[i];
      if (x >= sh.x && x <= sh.x + sh.w && y >= sh.y && y <= sh.y + sh.h) return { type: 'shelf', index: i };
    }
  }
  // Walls (line)
  if(floor.walls) {
    for (let i = 0; i < floor.walls.length; i++) {
      const w = floor.walls[i];
      const l2 = dist2(w.x1, w.y1, w.x2, w.y2);
      if (l2 === 0) continue;
      let t = ((x - w.x1) * (w.x2 - w.x1) + (y - w.y1) * (w.y2 - w.y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.sqrt(dist2(x, y, w.x1 + t * (w.x2 - w.x1), w.y1 + t * (w.y2 - w.y1)));
      if (d < hitToler) return { type: 'wall', index: i };
    }
  }
  // Stairs (line)
  if(floor.stairs) {
    for (let i = 0; i < floor.stairs.length; i++) {
      const s = floor.stairs[i];
      const l2 = dist2(s.x1, s.y1, s.x2, s.y2);
      if (l2 === 0) continue;
      let t = ((x - s.x1) * (s.x2 - s.x1) + (y - s.y1) * (s.y2 - s.y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.sqrt(dist2(x, y, s.x1 + t * (s.x2 - s.x1), s.y1 + t * (s.y2 - s.y1)));
      if (d < hitToler) return { type: 'stairs', index: i };
    }
  }
  // Paths (line)
  if(floor.paths) {
    for (let i = 0; i < floor.paths.length; i++) {
      const p = floor.paths[i];
      const l2 = dist2(p.x1, p.y1, p.x2, p.y2);
      if (l2 === 0) continue;
      let t = ((x - p.x1) * (p.x2 - p.x1) + (y - p.y1) * (p.y2 - p.y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.sqrt(dist2(x, y, p.x1 + t * (p.x2 - p.x1), p.y1 + t * (p.y2 - p.y1)));
      if (d < hitToler) return { type: 'path', index: i };
    }
  }
  // Zones (rectangle)
  if(floor.zones) {
    for (let i = floor.zones.length - 1; i >= 0; i--) {
      const z = floor.zones[i];
      const zx = Math.min(z.x1, z.x2), zy = Math.min(z.y1, z.y2);
      const zw = Math.abs(z.x2 - z.x1), zh = Math.abs(z.y2 - z.y1);
      if (x >= zx && x <= zx + zw && y >= zy && y <= zy + zh) return { type: 'zone', index: i };
    }
  }
  return null;
}

// ── Apply Drag/Resize to Item ──
function applyDrag(pos, shiftKey) {
  if (!dragItemRef || !dragStartBox || !dragStartMouse) return;
  
  const dx = pos.x - dragStartMouse.x;
  const dy = pos.y - dragStartMouse.y;
  // Pixel-perfect by default; Shift = snap to grid
  const sdx = shiftKey ? Math.round(dx / GRID_SIZE) * GRID_SIZE : dx;
  const sdy = shiftKey ? Math.round(dy / GRID_SIZE) * GRID_SIZE : dy;
  const base = dragStartBox;
  const item = dragItemRef;
  const h = dragHandle;
  
  if (h === 'move') {
    if (item.x !== undefined && item.w !== undefined) {
      item.x = base.x + sdx;
      item.y = base.y + sdy;
    } else if (item.x1 !== undefined) {
      item.x1 = base.x1 + sdx; item.y1 = base.y1 + sdy;
      item.x2 = base.x2 + sdx; item.y2 = base.y2 + sdy;
    } else if (item.x !== undefined) {
      item.x = base.x + sdx;
      item.y = base.y + sdy;
    }
  } else if (h === 'tl') {
    item.x = base.x + sdx; item.y = base.y + sdy;
    item.w = Math.max(GRID_SIZE, base.w - sdx); item.h = Math.max(GRID_SIZE, base.h - sdy);
  } else if (h === 'tr') {
    item.y = base.y + sdy;
    item.w = Math.max(GRID_SIZE, base.w + sdx); item.h = Math.max(GRID_SIZE, base.h - sdy);
  } else if (h === 'bl') {
    item.x = base.x + sdx;
    item.w = Math.max(GRID_SIZE, base.w - sdx); item.h = Math.max(GRID_SIZE, base.h + sdy);
  } else if (h === 'br') {
    item.w = Math.max(GRID_SIZE, base.w + sdx); item.h = Math.max(GRID_SIZE, base.h + sdy);
  } else if (h === 'top') {
    item.y = base.y + sdy; item.h = Math.max(GRID_SIZE, base.h - sdy);
  } else if (h === 'bottom') {
    item.h = Math.max(GRID_SIZE, base.h + sdy);
  } else if (h === 'left') {
    item.x = base.x + sdx; item.w = Math.max(GRID_SIZE, base.w - sdx);
  } else if (h === 'right') {
    item.w = Math.max(GRID_SIZE, base.w + sdx);
  } else if (h === 'p1') {
    item.x1 = base.x1 + sdx; item.y1 = base.y1 + sdy;
  } else if (h === 'p2') {
    item.x2 = base.x2 + sdx; item.y2 = base.y2 + sdy;
  }
  
  renderCad();
}

// ── Events ──
function setupCadEvents() {
  if (!cadCanvas) return;
  
  // ─── MOUSEDOWN ───
  cadCanvas.addEventListener('mousedown', e => {
    const pos = getMousePos(e);
    
    // Middle/Right click = Pan
    if (e.button === 1 || e.button === 2) {
      isPanning = true;
      panStartX = pos.rawX - panX;
      panStartY = pos.rawY - panY;
      return;
    }
    
    // If there's a selected item, check handles FIRST
    if (selectedItem && cadTool === 'select') {
      const selData = getItemData(selectedItem);
      if (selData) {
        const handleHit = hitTestHandles(pos.x, pos.y, selData, selectedItem.type, selectedItem.index);
        if (handleHit && handleHit.handle) {
          // Start drag/resize
          dragAction = handleHit.handle === 'move' ? 'move' : 'resize';
          dragHandle = handleHit.handle;
          dragItemRef = selData;
          dragStartBox = JSON.parse(JSON.stringify(selData));
          dragStartMouse = { x: pos.x, y: pos.y };
          return;
        }
      }
    }
    
    // SELECT tool
    if (cadTool === 'select') {
      const hit = getHoveredItem(pos.x, pos.y);
      if (hit && !hit.handle) {
        selectedItem = hit;
        // Start drag immediately
        const data = getItemData(hit);
        if (data) {
          dragAction = 'move';
          dragHandle = 'move';
          dragItemRef = data;
          dragStartBox = JSON.parse(JSON.stringify(data));
          dragStartMouse = { x: pos.x, y: pos.y };
        }
      } else if (!hit) {
        selectedItem = null;
      }
      renderCad();
      
    } else if (cadTool === 'erase') {
      const item = getHoveredItem(pos.x, pos.y);
      if (item && !item.handle) {
        blueprint.floors[currentFloor][window.getArrayName(item.type)].splice(item.index, 1);
        selectedItem = null;
        saveHistory(); renderCad(); if (typeof update3DScene === 'function') update3DScene();
      }
      
    } else if (cadTool === 'rotate') {
      const item = getHoveredItem(pos.x, pos.y);
      if (item && !item.handle) {
        const arr = blueprint.floors[currentFloor][window.getArrayName(item.type)];
        if(arr && arr[item.index]) {
          arr[item.index].angle = (arr[item.index].angle || 0) + (Math.PI / 2);
          saveHistory(); renderCad(); if (typeof update3DScene === 'function') update3DScene();
        }
      }
      
    } else if (['door', 'window', 'pillar'].includes(cadTool)) {
      const arr = blueprint.floors[currentFloor][window.getArrayName(cadTool)];
      let newItem;
      if (cadTool === 'door') newItem = { x: pos.sx, y: pos.sy, angle: 0 };
      if (cadTool === 'window') newItem = { x: pos.sx, y: pos.sy, angle: 0 };
      if (cadTool === 'pillar') newItem = { x: pos.sx, y: pos.sy, size: 20, angle: 0 };
      
      if (window.checkOverlap(newItem, cadTool)) {
        if(typeof showToast === 'function') showToast('Já existe um item nessa posição', 'error');
        return;
      }
      
      arr.push(newItem);
      const newIndex = arr.length - 1;
      selectedItem = { type: cadTool, index: newIndex };
      cadTool = 'select';
      document.querySelectorAll('.cad-tool').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === 'select');
      });
      window._cadFrameCamera3D = true; // Frame camera to new item
      saveHistory(); renderCad(); if (typeof update3DScene === 'function') update3DScene();
      
    } else if (cadTool === 'shelf') {
      const modal = document.getElementById('modal-cad-shelf');
      modal.style.display = 'flex';
      window.pendingShelfPos = { sx: pos.sx, sy: pos.sy };
      
      document.getElementById('btn-save-shelf').onclick = function() {
        const id = document.getElementById('shelf-id').value || 'SH-UNDEF';
        const levels = parseInt(document.getElementById('shelf-levels').value) || 3;
        const positions = parseInt(document.getElementById('shelf-positions').value) || 4;
        const width = parseInt(document.getElementById('shelf-width').value) || 100;
        const depth = parseInt(document.getElementById('shelf-depth').value) || 40;
        const arr = blueprint.floors[currentFloor].shelves;
        arr.push({ id: id, x: window.pendingShelfPos.sx, y: window.pendingShelfPos.sy, w: width, h: depth, levels: levels, positions: positions, angle: 0 });
        modal.style.display = 'none';
        selectedItem = { type: 'shelf', index: arr.length - 1 };
        cadTool = 'select';
        document.querySelectorAll('.cad-tool').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tool === 'select');
        });
        window._cadFrameCamera3D = true; // Frame camera to new shelf
        saveHistory(); renderCad(); if (typeof update3DScene === 'function') update3DScene();
      };
      
    } else if (['wall', 'stairs', 'path', 'zone', 'measure'].includes(cadTool)) {
      isDrawing = true;
      startX = pos.sx;
      startY = pos.sy;
      if(cadTool === 'wall') tempWall = { x1: startX, y1: startY, x2: startX, y2: startY };
      if(cadTool === 'measure') window.measureLine = { x1: startX, y1: startY, x2: startX, y2: startY };
      if(cadTool === 'zone') tempZone = { x1: startX, y1: startY, x2: startX, y2: startY };
      if(cadTool === 'path') tempPath = { x1: startX, y1: startY, x2: startX, y2: startY };
    }
  });

  // ─── MOUSEMOVE ───
  cadCanvas.addEventListener('mousemove', e => {
    const pos = getMousePos(e);
    
    if (isPanning) {
      panX = pos.rawX - panStartX;
      panY = pos.rawY - panStartY;
      renderCad();
      return;
    }
    
    // Dragging/Resizing
    if (dragAction && dragItemRef) {
      applyDrag(pos, e.shiftKey);
      renderCad();
      return;
    }
    
    // Drawing (wall, zone, etc.)
    if (isDrawing) {
      let targetX = pos.sx; let targetY = pos.sy;
      // Shift = free form; Default = constrain to H/V for walls
      if (!e.shiftKey && (cadTool === 'wall' || cadTool === 'measure' || cadTool === 'path' || cadTool === 'stairs')) {
        if (Math.abs(pos.sx - startX) > Math.abs(pos.sy - startY)) { targetY = startY; } else { targetX = startX; }
      }

      if (cadTool === 'wall' && tempWall) { tempWall.x2 = targetX; tempWall.y2 = targetY; }
      if (cadTool === 'measure' && window.measureLine) { window.measureLine.x2 = targetX; window.measureLine.y2 = targetY; }
      if (cadTool === 'zone' && tempZone) { tempZone.x2 = pos.sx; tempZone.y2 = pos.sy; }
      if (cadTool === 'path' && tempPath) { tempPath.x2 = targetX; tempPath.y2 = targetY; }
      
      renderCad();
    } else {
      // Hover detection
      hoveredItem = getHoveredItem(pos.x, pos.y);
      if (hoveredItem) {
        if (hoveredItem.handle) {
          const h = hoveredItem.handle;
          if (h === 'move') cadCanvas.style.cursor = 'move';
          else if (h === 'tl' || h === 'br') cadCanvas.style.cursor = 'nwse-resize';
          else if (h === 'tr' || h === 'bl') cadCanvas.style.cursor = 'nesw-resize';
          else if (h === 'top' || h === 'bottom') cadCanvas.style.cursor = 'ns-resize';
          else if (h === 'left' || h === 'right') cadCanvas.style.cursor = 'ew-resize';
          else if (h === 'p1' || h === 'p2') cadCanvas.style.cursor = 'crosshair';
          else cadCanvas.style.cursor = 'pointer';
        } else {
          cadCanvas.style.cursor = 'pointer';
        }
      } else {
        cadCanvas.style.cursor = cadTool === 'select' ? 'default' : 'crosshair';
      }
      renderCad();
    }
  });

  // ─── MOUSEUP ───
  cadCanvas.addEventListener('mouseup', e => {
    isPanning = false;
    
    // Finish drag/resize
    if (dragAction && dragItemRef) {
      // Check if actually moved (not just a click)
      const pos = getMousePos(e);
      const movedDist = Math.hypot(pos.x - dragStartMouse.x, pos.y - dragStartMouse.y);
      if (movedDist > 2) {
        saveHistory();
        if (typeof update3DScene === 'function') update3DScene();
      }
      dragAction = null;
      dragHandle = null;
      dragItemRef = null;
      dragStartBox = null;
      dragStartMouse = null;
      renderCad();
      return;
    }
    
    // Finish drawing
    if (isDrawing) {
      isDrawing = false;
      const pos = getMousePos(e);
      let targetX = pos.sx; let targetY = pos.sy;
      
      if (!e.shiftKey && (cadTool === 'wall' || cadTool === 'measure' || cadTool === 'path' || cadTool === 'stairs')) {
        if (Math.abs(pos.sx - startX) > Math.abs(pos.sy - startY)) { targetY = startY; } else { targetX = startX; }
      }

      // Clear temp visuals FIRST
      tempWall = null;
      tempZone = null;
      tempPath = null;
      window.measureLine = (cadTool === 'measure') ? window.measureLine : null;

      let pushedItem = null;
      let pushedType = null;
      const dragDist = Math.hypot(targetX - startX, targetY - startY);
      
      if (dragDist > 5) {
         if (cadTool === 'wall') pushedItem = { x1: startX, y1: startY, x2: targetX, y2: targetY };
         if (cadTool === 'stairs') pushedItem = { x1: startX, y1: startY, x2: targetX, y2: targetY };
         if (cadTool === 'path') pushedItem = { x1: startX, y1: startY, x2: targetX, y2: targetY };
         if (cadTool === 'zone') pushedItem = { x1: Math.min(startX, pos.sx), y1: Math.min(startY, pos.sy), x2: Math.max(startX, pos.sx), y2: Math.max(startY, pos.sy) };
      } else {
         // Single click = create default-sized item
         if (cadTool === 'wall') pushedItem = { x1: startX, y1: startY, x2: startX + 100, y2: startY };
         if (cadTool === 'stairs') pushedItem = { x1: startX, y1: startY, x2: startX + 100, y2: startY };
         if (cadTool === 'path') pushedItem = { x1: startX, y1: startY, x2: startX + 100, y2: startY };
         if (cadTool === 'zone') pushedItem = { x1: startX, y1: startY, x2: startX + 100, y2: startY + 100 };
      }
      
      if (pushedItem && cadTool !== 'measure') {
        pushedType = cadTool;
        
        if (window.checkOverlap(pushedItem, pushedType)) {
          if(typeof showToast === 'function') showToast('Já existe um item nessa posição', 'error');
          renderCad();
          return;
        }
        
        const arr = blueprint.floors[currentFloor][window.getArrayName(pushedType)];
        arr.push(pushedItem);
        const newIndex = arr.length - 1;
        selectedItem = { type: pushedType, index: newIndex };
        // Switch to select mode WITHOUT clearing selection
        cadTool = 'select';
        document.querySelectorAll('.cad-tool').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tool === 'select');
        });
        window._cadFrameCamera3D = true; // Frame camera to new item
        saveHistory(); if (typeof update3DScene === 'function') update3DScene();
      }
      
      renderCad();
    }
  });

  // ─── ZOOM (Wheel) ───
  cadCanvas.addEventListener('wheel', e => {
    e.preventDefault();
    const pos = getMousePos(e);
    
    const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1;
    zoom *= zoomAmount;
    if (zoom < 0.1) zoom = 0.1;
    if (zoom > 5) zoom = 5;
    
    // Adjust pan to zoom into the mouse pointer
    panX = pos.rawX - pos.x * zoom;
    panY = pos.rawY - pos.y * zoom;
    
    renderCad();
  });

  // Context menu
  cadCanvas.addEventListener('contextmenu', e => e.preventDefault());
}


// ── Rendering ──
function drawBlueprintGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  
  const sX = -panX / zoom;
  const sY = -panY / zoom;
  const eX = sX + cadCanvas.width / zoom;
  const eY = sY + cadCanvas.height / zoom;
  
  const gsx = Math.floor(sX / GRID_SIZE) * GRID_SIZE;
  const gsy = Math.floor(sY / GRID_SIZE) * GRID_SIZE;
  
  ctx.beginPath();
  for (let x = gsx; x <= eX; x += GRID_SIZE) { ctx.moveTo(x, sY); ctx.lineTo(x, eY); }
  for (let y = gsy; y <= eY; y += GRID_SIZE) { ctx.moveTo(sX, y); ctx.lineTo(eX, y); }
  ctx.stroke();
  
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  for (let x = gsx; x <= eX; x += GRID_SIZE) {
    if(x % (GRID_SIZE*5) === 0) { ctx.moveTo(x, sY); ctx.lineTo(x, eY); }
  }
  for (let y = gsy; y <= eY; y += GRID_SIZE) {
    if(y % (GRID_SIZE*5) === 0) { ctx.moveTo(sX, y); ctx.lineTo(eX, y); }
  }
  ctx.stroke();
}


function drawBoundingBox(box) {
  ctx.save();
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 2 / zoom;
  
  if (box.w !== undefined) {
    ctx.setLineDash([6/zoom, 4/zoom]);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2 / zoom;
    
    const drawCircleHandle = (hx, hy) => {
      ctx.beginPath();
      ctx.arc(hx, hy, 5 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    
    // Corner handles
    drawCircleHandle(box.x, box.y);
    drawCircleHandle(box.x + box.w, box.y);
    drawCircleHandle(box.x, box.y + box.h);
    drawCircleHandle(box.x + box.w, box.y + box.h);
    
    // Edge handles (pill shape)
    const drawPillHandle = (hx, hy, vertical) => {
       ctx.save();
       ctx.translate(hx, hy);
       if (vertical) ctx.rotate(Math.PI/2);
       ctx.beginPath();
       if (ctx.roundRect) {
         ctx.roundRect(-8/zoom, -4/zoom, 16/zoom, 8/zoom, 4/zoom);
       } else {
         ctx.rect(-8/zoom, -4/zoom, 16/zoom, 8/zoom);
       }
       ctx.fill();
       ctx.stroke();
       ctx.restore();
    };
    
    drawPillHandle(box.x + box.w/2, box.y, false);        // top
    drawPillHandle(box.x + box.w/2, box.y + box.h, false); // bottom
    drawPillHandle(box.x, box.y + box.h/2, true);          // left
    drawPillHandle(box.x + box.w, box.y + box.h/2, true);  // right
    
    // Dimensions label
    ctx.fillStyle = 'rgba(139, 92, 246, 0.85)';
    ctx.font = `${10/zoom}px "Inter", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(box.w)} × ${Math.round(box.h)}`, box.x + box.w/2, box.y - 8/zoom);
    
  } else if (box.x1 !== undefined) {
    const dx = box.x2 - box.x1;
    const dy = box.y2 - box.y1;
    const length = Math.hypot(dx, dy);
    
    // Dashed selection line along the wall
    ctx.setLineDash([6/zoom, 4/zoom]);
    ctx.beginPath();
    ctx.moveTo(box.x1, box.y1);
    ctx.lineTo(box.x2, box.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Endpoint handles
    ctx.fillStyle = '#fff';
    const drawCircleHandle = (hx, hy) => {
      ctx.beginPath();
      ctx.arc(hx, hy, 6 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    drawCircleHandle(box.x1, box.y1);
    drawCircleHandle(box.x2, box.y2);
    
    // Length label
    ctx.fillStyle = 'rgba(139, 92, 246, 0.85)';
    ctx.font = `${10/zoom}px "Inter", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(length)} px`, (box.x1+box.x2)/2, (box.y1+box.y2)/2 - 12/zoom);
    
  } else {
    // Point-based items
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(box.x, box.y, 6 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function renderCad() {
  if (!ctx) return;
  
  ctx.fillStyle = '#0f111a';
  ctx.fillRect(0, 0, cadCanvas.width, cadCanvas.height);
  
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);
  
  drawBlueprintGrid();

  const floor = blueprint.floors[currentFloor];
  if (!floor) { ctx.restore(); return; }

  // ── Shelves ──
  if (floor.shelves) {
    floor.shelves.forEach((sh, i) => {
      const isHover = hoveredItem && !hoveredItem.handle && hoveredItem.type === 'shelf' && hoveredItem.index === i;
      const isSel = selectedItem && selectedItem.type === 'shelf' && selectedItem.index === i;
      const isHighlight = highlightedSlotId && highlightedSlotId.toUpperCase() === (sh.id || '').toUpperCase();
      
      ctx.fillStyle = isHighlight ? 'rgba(34, 197, 94, 0.3)' : 'rgba(37, 99, 235, 0.15)';
      ctx.fillRect(sh.x, sh.y, sh.w, sh.h);
      
      ctx.strokeStyle = isHighlight ? '#22c55e' : (isHover || isSel ? '#3b82f6' : '#1e3a8a');
      ctx.lineWidth = isHighlight ? 4 : 2;
      ctx.strokeRect(sh.x, sh.y, sh.w, sh.h);
      
      // Slots
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const slotCount = Math.max(1, Math.floor(sh.w / 25));
      const slotW = sh.w / slotCount;
      for(let s=1; s<slotCount; s++){
        ctx.moveTo(sh.x + s*slotW, sh.y);
        ctx.lineTo(sh.x + s*slotW, sh.y + sh.h);
      }
      ctx.stroke();

      if(isHighlight) {
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#22c55e';
        ctx.strokeRect(sh.x, sh.y, sh.w, sh.h);
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = isHighlight ? '#22c55e' : '#94a3b8';
      ctx.font = '10px "Inter", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(sh.id || 'UNDEF', sh.x + sh.w/2, sh.y + sh.h/2 + 3);
    });
  }

  // ── Walls ──
  if (floor.walls) {
    floor.walls.forEach((w, i) => {
      const isHover = hoveredItem && !hoveredItem.handle && hoveredItem.type === 'wall' && hoveredItem.index === i;
      const isSel = selectedItem && selectedItem.type === 'wall' && selectedItem.index === i;
      
      ctx.strokeStyle = (isHover || isSel) ? '#00d2ff' : '#64748b';
      ctx.lineWidth = 10;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
      
      ctx.strokeStyle = (isHover || isSel) ? '#ffffff' : '#94a3b8';
      ctx.lineWidth = 6;
      ctx.stroke();
    });
  }

  // ── Temp Wall ──
  if (tempWall) {
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 10;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(tempWall.x1, tempWall.y1);
    ctx.lineTo(tempWall.x2, tempWall.y2);
    ctx.stroke();
    
    // Length indicator
    const tLen = Math.hypot(tempWall.x2 - tempWall.x1, tempWall.y2 - tempWall.y1);
    if (tLen > 10) {
      ctx.fillStyle = '#00d2ff';
      ctx.font = `${11/zoom}px "Inter", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(tLen)} px`, (tempWall.x1+tempWall.x2)/2, (tempWall.y1+tempWall.y2)/2 - 12/zoom);
    }
  }

  // ── Zones ──
  if (floor.zones) {
    floor.zones.forEach((z, i) => {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.15)';
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      const w = z.x2 - z.x1;
      const h = z.y2 - z.y1;
      ctx.fillRect(z.x1, z.y1, w, h);
      ctx.strokeRect(z.x1, z.y1, w, h);
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#f97316';
      ctx.font = '10px monospace';
      ctx.fillText(`ZONE-${i}`, z.x1 + 4, z.y1 + 12);
    });
  }

  // ── Paths ──
  if (floor.paths) {
    floor.paths.forEach((p) => {
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  // ── Stairs ──
  if (floor.stairs) {
    floor.stairs.forEach(s => {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const length = Math.hypot(dx, dy);
      const steps = Math.floor(length / 10);
      for(let i=1; i<steps; i++) {
        const t = i / steps;
        const px = s.x1 + dx * t;
        const py = s.y1 + dy * t;
        const angle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(px - Math.sin(angle) * 10, py + Math.cos(angle) * 10);
        ctx.lineTo(px + Math.sin(angle) * 10, py - Math.cos(angle) * 10);
        ctx.stroke();
      }
    });
  }

  // ── Measure Line ──
  if (window.measureLine) {
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(window.measureLine.x1, window.measureLine.y1);
    ctx.lineTo(window.measureLine.x2, window.measureLine.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    const mdx = window.measureLine.x2 - window.measureLine.x1;
    const mdy = window.measureLine.y2 - window.measureLine.y1;
    const mDist = Math.hypot(mdx, mdy);
    
    ctx.fillStyle = '#0ea5e9';
    ctx.font = '12px monospace';
    ctx.fillText(`${mDist.toFixed(1)} px`, window.measureLine.x1 + mdx/2 + 5, window.measureLine.y1 + mdy/2 - 5);
  }
  
  // ── Temp Zone & Path ──
  if (tempZone) {
    ctx.fillStyle = 'rgba(249, 115, 22, 0.1)';
    ctx.strokeStyle = '#f97316';
    ctx.setLineDash([5, 5]);
    ctx.fillRect(tempZone.x1, tempZone.y1, tempZone.x2 - tempZone.x1, tempZone.y2 - tempZone.y1);
    ctx.strokeRect(tempZone.x1, tempZone.y1, tempZone.x2 - tempZone.x1, tempZone.y2 - tempZone.y1);
    ctx.setLineDash([]);
  }
  if (tempPath) {
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(tempPath.x1, tempPath.y1);
    ctx.lineTo(tempPath.x2, tempPath.y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Doors ──
  if (floor.doors) {
    floor.doors.forEach((d, i) => {
      const isHover = hoveredItem && !hoveredItem.handle && hoveredItem.type === 'door' && hoveredItem.index === i;
      const a = d.angle || 0;
      
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(a);
      
      ctx.strokeStyle = isHover ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(40, 0);
      ctx.stroke();
      
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI / 2);
      ctx.lineTo(0,0);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.restore();
    });
  }

  // ── Windows ──
  if (floor.windows) {
    floor.windows.forEach((win, i) => {
      const isHover = hoveredItem && !hoveredItem.handle && hoveredItem.type === 'window' && hoveredItem.index === i;
      ctx.save();
      ctx.translate(win.x, win.y);
      ctx.rotate(win.angle);
      ctx.fillStyle = isHover ? '#60a5fa' : '#38bdf8';
      ctx.fillRect(-20, -4, 40, 8);
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1;
      ctx.strokeRect(-20, -4, 40, 8);
      ctx.restore();
    });
  }

  // ── Pillars ──
  if (floor.pillars) {
    floor.pillars.forEach((pil, i) => {
      const isHover = hoveredItem && !hoveredItem.handle && hoveredItem.type === 'pillar' && hoveredItem.index === i;
      ctx.fillStyle = isHover ? '#94a3b8' : '#475569';
      ctx.fillRect(pil.x - pil.size/2, pil.y - pil.size/2, pil.size, pil.size);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.strokeRect(pil.x - pil.size/2, pil.y - pil.size/2, pil.size, pil.size);
    });
  }

  // ── Selected Item Bounding Box ──
  if (selectedItem) {
    const selData = getItemData(selectedItem);
    if (selData) {
      drawBoundingBox(selData);
    }
  }

  ctx.restore();
  
  // ── Debug HUD (screen space, after ctx.restore) ──
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(5, cadCanvas.height - 105, 280, 100);
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillText(`CACHE CLEARED - V2`, 10, cadCanvas.height - 88);
  ctx.fillStyle = '#00ff88';
  ctx.font = '11px "Inter", monospace';
  ctx.textAlign = 'left';
  const floor2 = blueprint.floors[currentFloor];
  const wCount = floor2 && floor2.walls ? floor2.walls.length : 0;
  const sCount = floor2 && floor2.shelves ? floor2.shelves.length : 0;
  ctx.fillText(`CAD v4.1 | Tool: ${cadTool} | Zoom: ${zoom.toFixed(2)}`, 10, cadCanvas.height - 68);
  ctx.fillText(`Walls: ${wCount} | Shelves: ${sCount} | Floor: ${currentFloor}`, 10, cadCanvas.height - 52);
  ctx.fillText(`Selected: ${selectedItem ? selectedItem.type + '[' + selectedItem.index + ']' : 'none'}`, 10, cadCanvas.height - 36);
  ctx.fillText(`Drag: ${dragAction || 'none'} | Handle: ${dragHandle || 'none'}`, 10, cadCanvas.height - 20);
  ctx.restore();
}


// ── Save / Load & Export ──
window.openSaveModal = function() {
  if(!blueprint.config) blueprint.config = {};
  
  document.getElementById('save-proj-name').value = blueprint.name || '';
  document.getElementById('save-proj-sector').value = blueprint.config.sector || '';
  document.getElementById('save-proj-machinery').value = blueprint.config.machinery || '';
  document.getElementById('save-proj-location').value = blueprint.config.location || '';
  
  // Generate Item Index Summary
  let summary = '';
  const floor = blueprint.floors[currentFloor];
  if(floor) {
    summary += `ANDAR: ${currentFloor}\n`;
    summary += `---------------------\n`;
    if(floor.walls && floor.walls.length) {
      summary += `Paredes (${floor.walls.length}):\n`;
      floor.walls.forEach((w, i) => summary += `  [${i}] X1:${Math.round(w.x1)}, Y1:${Math.round(w.y1)} -> X2:${Math.round(w.x2)}, Y2:${Math.round(w.y2)}\n`);
    }
    if(floor.shelves && floor.shelves.length) {
      summary += `\nPrateleiras (${floor.shelves.length}):\n`;
      floor.shelves.forEach((s, i) => summary += `  [${i}] ID:${s.id || 'N/A'}, X:${Math.round(s.x)}, Y:${Math.round(s.y)}, W:${s.w}, H:${s.h}\n`);
    }
    if(floor.doors && floor.doors.length) {
      summary += `\nPortas (${floor.doors.length}):\n`;
      floor.doors.forEach((d, i) => summary += `  [${i}] X:${Math.round(d.x)}, Y:${Math.round(d.y)}\n`);
    }
    if(floor.windows && floor.windows.length) {
      summary += `\nJanelas (${floor.windows.length}):\n`;
      floor.windows.forEach((w, i) => summary += `  [${i}] X:${Math.round(w.x)}, Y:${Math.round(w.y)}\n`);
    }
    if(floor.pillars && floor.pillars.length) {
      summary += `\nPilares (${floor.pillars.length}):\n`;
      floor.pillars.forEach((p, i) => summary += `  [${i}] X:${Math.round(p.x)}, Y:${Math.round(p.y)}\n`);
    }
  } else {
    summary = 'Nenhum item no andar atual.';
  }
  
  document.getElementById('save-proj-index').value = summary;
  document.getElementById('modal-cad-save').style.display = 'flex';
}

window.saveBlueprint = async function() {
  blueprint.name = document.getElementById('save-proj-name').value;
  if(!blueprint.config) blueprint.config = {};
  blueprint.config.sector = document.getElementById('save-proj-sector').value;
  blueprint.config.machinery = document.getElementById('save-proj-machinery').value;
  blueprint.config.location = document.getElementById('save-proj-location').value;

  const res = await API.put('/warehouse/layout', { blueprint_data: blueprint });
  if (res.success || res.message) {
    if(typeof showToast === 'function') showToast('Planta CAD salva com sucesso', 'success');
    document.getElementById('modal-cad-save').style.display = 'none';
  } else {
    if(typeof showToast === 'function') showToast('Erro ao salvar', 'error');
  }
}

window.clearBlueprint = function() {
  if (confirm('Aviso: Isso apagará todas as paredes, prateleiras e itens deste andar. Continuar?')) {
    blueprint.floors[currentFloor] = { walls: [], doors: [], windows: [], pillars: [], shelves: [], stairs: [], zones: [], paths: [] };
    selectedItem = null;
    renderCad();
    if(cadViewMode === '3d') update3DScene();
  }
}

// ── CAD History Stack (Undo / Redo) ──
window.getArrayName = function(type) {
  if (type === 'stairs') return 'stairs';
  if (type === 'path') return 'paths';
  if (type === 'zone') return 'zones';
  if (type === 'shelf') return 'shelves';
  if (type === 'pillar') return 'pillars';
  if (type === 'window') return 'windows';
  if (type === 'door') return 'doors';
  if (type === 'wall') return 'walls';
  return type + 's';
};

window.cadHistory = [];
window.cadHistoryIndex = -1;

window.saveHistory = function() {
  if (window.cadHistoryIndex < window.cadHistory.length - 1) {
    window.cadHistory = window.cadHistory.slice(0, window.cadHistoryIndex + 1);
  }
  window.cadHistory.push(JSON.parse(JSON.stringify(blueprint)));
  window.cadHistoryIndex++;
};

window.undoCad = function() {
  if (window.cadHistoryIndex > 0) {
    window.cadHistoryIndex--;
    blueprint = JSON.parse(JSON.stringify(window.cadHistory[window.cadHistoryIndex]));
    selectedItem = null;
    renderCad();
    if (typeof update3DScene === 'function') update3DScene();
  }
};

window.redoCad = function() {
  if (window.cadHistoryIndex < window.cadHistory.length - 1) {
    window.cadHistoryIndex++;
    blueprint = JSON.parse(JSON.stringify(window.cadHistory[window.cadHistoryIndex]));
    selectedItem = null;
    renderCad();
    if (typeof update3DScene === 'function') update3DScene();
  }
};

window.loadBlueprint = function() {
  const saved = localStorage.getItem('evah_cad_blueprint');
  if (saved) {
    try {
      blueprint = JSON.parse(saved);
      // Sanitize corrupt data from previous bugs
      Object.keys(blueprint.floors).forEach(fIndex => {
        const f = blueprint.floors[fIndex];
        if (f.walls) f.walls = f.walls.filter(w => w.x1 !== w.x2 || w.y1 !== w.y2);
        if (f.stairs) f.stairs = f.stairs.filter(w => w.x1 !== w.x2 || w.y1 !== w.y2);
        if (f.paths) f.paths = f.paths.filter(w => w.x1 !== w.x2 || w.y1 !== w.y2);
        if (f.zones) f.zones = f.zones.filter(w => Math.abs(w.x2 - w.x1) > 5 && Math.abs(w.y2 - w.y1) > 5);
      });
      window.cadHistory = [JSON.parse(JSON.stringify(blueprint))];
      window.cadHistoryIndex = 0;
      renderCad();
    } catch(e) { console.error('Erro ao carregar blueprint', e); }
  }
};

// Keydown listener for Shortcuts
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    undoCad();
  } else if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    redoCad();
  } else if (e.key === 'Escape') {
    cadTool = 'select';
    document.querySelectorAll('.cad-tool').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === 'select');
    });
    selectedItem = null;
    window.measureLine = null;
    dragAction = null; dragHandle = null; dragItemRef = null;
    renderCad();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedItem) {
      const arr = blueprint.floors[currentFloor][window.getArrayName(selectedItem.type)];
      if (arr && arr[selectedItem.index]) {
        arr.splice(selectedItem.index, 1);
        selectedItem = null;
        hoveredItem = null;
        saveHistory();
        renderCad();
        if (typeof update3DScene === 'function') update3DScene();
      }
    }
  }
});

// Clear Blueprint (second definition, keep both for compatibility)
window.clearBlueprint = function() {
  if (confirm("Deseja realmente limpar todo o documento CAD? Esta ação pode ser desfeita.")) {
    blueprint = {
      floors: {
        0: { walls: [], doors: [], windows: [], pillars: [], shelves: [], stairs: [], zones: [], paths: [] },
        1: { walls: [], doors: [], windows: [], pillars: [], shelves: [], stairs: [], zones: [], paths: [] },
        2: { walls: [], doors: [], windows: [], pillars: [], shelves: [], stairs: [], zones: [], paths: [] }
      }
    };
    selectedItem = null;
    saveHistory();
    renderCad();
    if (typeof update3DScene === 'function') update3DScene();
  }
};

// Inspect Shelf Logic
window.openInspectShelfModal = function(shelf, shelfIndex) {
  document.getElementById('inspect-shelf-id-display').textContent = shelf.id || `RACK-${shelfIndex}`;
  if (!shelf.items) shelf.items = [];
  
  const renderItemsList = () => {
    const list = document.getElementById('inspect-items-list');
    list.innerHTML = '';
    if (shelf.items.length === 0) {
      list.innerHTML = '<div style="padding: 10px; color: #888; text-align: center; font-size: 12px;">Nenhuma carga nesta prateleira.</div>';
      return;
    }
    shelf.items.forEach((item, idx) => {
      const div = document.createElement('div');
      div.style.padding = '8px';
      div.style.borderBottom = '1px solid var(--surface-border)';
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.alignItems = 'center';
      
      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.alignItems = 'center';
      info.style.gap = '8px';
      
      const colorBox = document.createElement('div');
      colorBox.style.width = '12px'; colorBox.style.height = '12px';
      colorBox.style.borderRadius = '2px';
      colorBox.style.background = item.color;
      
      const txt = document.createElement('span');
      txt.style.fontSize = '12px';
      txt.innerHTML = `<strong>${item.name}</strong> <span style="color:#666">(Nível ${item.level}, Pos ${item.position})</span>`;
      
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Remover';
      delBtn.style.background = 'transparent';
      delBtn.style.border = 'none';
      delBtn.style.color = '#e74c3c';
      delBtn.style.cursor = 'pointer';
      delBtn.style.fontSize = '11px';
      delBtn.onclick = () => {
        shelf.items.splice(idx, 1);
        saveHistory();
        renderItemsList();
        if (typeof update3DScene === 'function') update3DScene();
      };
      
      info.appendChild(colorBox);
      info.appendChild(txt);
      div.appendChild(info);
      div.appendChild(delBtn);
      list.appendChild(div);
    });
  };
  
  renderItemsList();
  
  document.getElementById('btn-add-inspect-item').onclick = () => {
    const name = document.getElementById('inspect-item-name').value;
    const level = parseInt(document.getElementById('inspect-item-level').value) || 1;
    const position = parseInt(document.getElementById('inspect-item-position').value) || 1;
    const color = document.getElementById('inspect-item-color').value;
    
    if(!name) { alert("Digite um nome para a carga"); return; }
    
    shelf.items.push({ name, level, position, color });
    document.getElementById('inspect-item-name').value = '';
    
    saveHistory();
    renderItemsList();
    if (typeof update3DScene === 'function') update3DScene();
  };
  
  document.getElementById('modal-cad-inspect-shelf').style.display = 'flex';
};

window.getCadBlueprint = function() { return typeof blueprint !== 'undefined' ? blueprint : null; };
