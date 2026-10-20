/* ============================================================
   Sistema Builder 3D — Architectural & Hierarchical Engine
   ============================================================ */

let scene, camera, renderer, controls;
let container3D;
let cad3DResizeObserver;
window.resizeCad3D = function() {
  if (!container3D || !camera || !renderer) return;
  const width = container3D.clientWidth, height = container3D.clientHeight;
  if (width <= 0 || height <= 0) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  animate();
};
let environmentGroup;
let productGroup;

let highlightedSlot3D = null;
let highlightedMaterial = null;
let highlightData = null; // Coordinates for placing the product
let loadedProductMesh = null;
let sceneGeneration = 0;
let productLoadGeneration = 0;
let hudOverlay = null;

// Parse "RUA1-N1-P1" format
function parseLocation(loc) {
  if (!loc) return { shelfId: '', level: 1, position: 1, raw: '' };
  const parts = loc.trim().split('-');
  let shelfId = loc.trim();
  let level = 1;
  let position = 1;
  
  if (parts.length >= 3) {
    const pPart = parts[parts.length - 1];
    const nPart = parts[parts.length - 2];
    
    if (nPart.startsWith('N') && pPart.startsWith('P')) {
      level = parseInt(nPart.replace('N', '')) || 1;
      position = parseInt(pPart.replace('P', '')) || 1;
      shelfId = parts.slice(0, parts.length - 2).join('-');
    }
  }
  return { shelfId, level, position, raw: loc };
}

window.initCad3D = function(blueprintData) {
  container3D = document.getElementById('cadContainer3d');
  
  if (!scene) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#f4f5f6'); // Fusion 360 Light background
    
    // Perspective Camera setup with Isometric-like feel (Narrow FOV, far away)
    camera = new THREE.PerspectiveCamera(35, container3D.clientHeight > 0 ? Math.max(1, container3D.clientWidth) / container3D.clientHeight : 1, 1, 20000);
    camera.position.set(1500, 2000, 1500); // High up and angled
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(Math.max(1, container3D.clientWidth), Math.max(1, container3D.clientHeight));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = window.ASTHA_MAP_QUALITY === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container3D.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(500, 0, 500); // Focus point
    camera.lookAt(500, 0, 500);
    controls.update();
    controls.addEventListener('change', animate);

    // Architectural Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
    dirLight.position.set(1000, 2000, 1000);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -2000;
    dirLight.shadow.camera.right = 2000;
    dirLight.shadow.camera.top = 2000;
    dirLight.shadow.camera.bottom = -2000;
    dirLight.shadow.camera.far = 10000;
    scene.add(dirLight);

    window.highlightSpotlight = new THREE.SpotLight('#22c55e', 0);
    window.highlightSpotlight.position.set(0, 400, 0);
    window.highlightSpotlight.angle = Math.PI / 5;
    window.highlightSpotlight.penumbra = 0.5;
    window.highlightSpotlight.castShadow = true;
    scene.add(window.highlightSpotlight);

    environmentGroup = new THREE.Group();
    scene.add(environmentGroup);
    
    productGroup = new THREE.Group();
    scene.add(productGroup);
    
    // HUD Legend
    hudOverlay = document.createElement('div');
    hudOverlay.style.position = 'absolute';
    hudOverlay.style.bottom = '30px';
    hudOverlay.style.left = '50%';
    hudOverlay.style.transform = 'translateX(-50%)';
    hudOverlay.style.background = 'rgba(15, 17, 26, 0.95)';
    hudOverlay.style.color = '#fff';
    hudOverlay.style.padding = '16px 32px';
    hudOverlay.style.borderRadius = '16px';
    hudOverlay.style.fontFamily = '"Inter", sans-serif';
    hudOverlay.style.fontSize = '15px';
    hudOverlay.style.boxShadow = '0 10px 40px rgba(0,0,0,0.4)';
    hudOverlay.style.display = 'none';
    hudOverlay.style.pointerEvents = 'none';
    hudOverlay.style.zIndex = '999';
    hudOverlay.style.border = '1px solid #22c55e';
    hudOverlay.style.textAlign = 'center';
    hudOverlay.style.lineHeight = '1.5';
    container3D.style.position = 'relative';
    container3D.appendChild(hudOverlay);

    animate();
    
    window.addEventListener('resize', window.resizeCad3D);
    if (window.ResizeObserver) {
      cad3DResizeObserver = new ResizeObserver(window.resizeCad3D);
      cad3DResizeObserver.observe(container3D);
    }
    
    // Track when user is actively navigating the 3D view
    // so the camera auto-frame doesn't violently jump while orbiting
    window.cadUserIsOrbiting = false;
    renderer.domElement.addEventListener('mousedown', () => { window.cadUserIsOrbiting = true; });
    renderer.domElement.addEventListener('mouseup', () => { window.cadUserIsOrbiting = false; });
    renderer.domElement.addEventListener('touchstart', () => { window.cadUserIsOrbiting = true; }, { passive: true });
    renderer.domElement.addEventListener('touchend', () => { window.cadUserIsOrbiting = false; }, { passive: true });
  }
  
  // Always render scene after init (handles both first load and reinit)
  update3DScene();
}

// Helpers for Autodesk Edges
function applyEdges(mesh, color='#333333') {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: color, linewidth: 1 }));
  mesh.add(line);
}

function disposeObject3D(root) {
  const geometries=new Set(), materials=new Set(), textures=new Set();
  root.traverse(child => {
    if (child.geometry) geometries.add(child.geometry);
    const values=Array.isArray(child.material)?child.material:child.material?[child.material]:[];
    values.forEach(material => { materials.add(material); Object.keys(material).forEach(key => { if(material[key]&&material[key].isTexture) textures.add(material[key]); }); });
  });
  textures.forEach(texture=>texture.dispose()); geometries.forEach(geometry=>geometry.dispose()); materials.forEach(material=>material.dispose());
}

function clearProductGroup() {
  disposeObject3D(productGroup);
  productGroup.clear();
  loadedProductMesh=null;
}

let cadRenderFrame = null;
function animate() {
  if (cadRenderFrame !== null) return;
  cadRenderFrame = requestAnimationFrame(() => {
    cadRenderFrame = null;
    const cube = document.getElementById('view-cube');
    if (cube && camera) {
      const e = camera.rotation;
      cube.style.transform = `rotateX(${e.x}rad) rotateY(${e.y}rad) rotateZ(${e.z}rad)`;
    }
    const moving=window.ASTHAIndustrialGenerators?.animate(scene,performance.now());
    renderer.render(scene, camera);
    if(moving&&!document.hidden&&renderer.domElement.getClientRects().length)animate();
  });
}

// ── Item Placement & Highlighting ──

window.highlightSlot3D = async function(slotId, material) {
  const loadGeneration = ++productLoadGeneration;
  highlightedSlot3D = slotId;
  highlightedMaterial = material;
  
  const loc = parseLocation(slotId);
  
  if (hudOverlay && material) {
    hudOverlay.replaceChildren();
    const heading = document.createElement('span');
    heading.style.cssText = 'font-size:12px;color:#a8b2d1;text-transform:uppercase;letter-spacing:1px;font-weight:700;';
    heading.textContent = 'Localização Encontrada';
    const detail = document.createElement('div');
    detail.textContent = `Item ${material.desc || ''} em Prateleira ${loc.shelfId || ''} • Nível ${loc.level || ''} • Pos ${loc.position || ''}`;
    hudOverlay.append(heading, detail);
    hudOverlay.style.display = 'block';
  } else if (hudOverlay) {
    hudOverlay.style.display = 'none';
  }
  
  // Clear previous product
  clearProductGroup();
  
  update3DScene(); 
  
  if (material && highlightData) {
    try {
      const res = await API.get(`/materials/${material.code}/files`);
      if (res.success && res.data) {
        const prod3D = res.data.find(f => f.category === 'product_3d' && f.filename.match(/\.(stl|obj|gltf|glb)$/i));
        if (prod3D) {
          hudOverlay.append(document.createElement('br'), Object.assign(document.createElement('small'), { textContent: 'Baixando modelo 3D real...' }));
          await loadProduct3D(prod3D.url, prod3D.filename, loadGeneration);
        } else {
          placeCardboardBox(loadGeneration);
        }
      } else {
        placeCardboardBox(loadGeneration);
      }
    } catch(e) {
      placeCardboardBox(loadGeneration);
    }
  } else if (material && !highlightData) {
      const warning = document.createElement('small');
      warning.textContent = `A prateleira ${loc.shelfId} não está desenhada no mapa!`;
      hudOverlay.append(document.createElement('br'), warning);
  }

  // Cancel any existing timeout
  if(window.hlTimeout) clearTimeout(window.hlTimeout);
  
  window.hlTimeout = setTimeout(() => {
    if(highlightedSlot3D === slotId) {
      highlightedSlot3D = null;
      highlightedMaterial = null;
      highlightData = null;
      if(hudOverlay) hudOverlay.style.display = 'none';
      clearProductGroup();
      update3DScene();
    }
  }, 20000); // 20s display
}

window.cadAutoScaleEnabled = true;
window.toggle3DAutoScale = function(enabled) {
  window.cadAutoScaleEnabled = enabled;
  if(typeof showToast === 'function') showToast(`Auto-Escala 3D ${enabled?'Ativada':'Desativada'}`, 'info');
}

async function loadProduct3D(url, filename, loadGeneration) {
  return new Promise((resolve) => {
    if (filename.toLowerCase().endsWith('.stl')) {
      const loader = new THREE.STLLoader();
      loader.load(url, (geometry) => {
        if (loadGeneration !== productLoadGeneration) { geometry.dispose(); resolve(); return; }
        const material = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 });
        const mesh = new THREE.Mesh(geometry, material);
        
        if (window.cadAutoScaleEnabled) {
          geometry.computeBoundingBox();
          const size = geometry.boundingBox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 20 / maxDim; // Max 20px size
          mesh.scale.set(scale, scale, scale);
        }
        
        // Translate geometry so bottom sits at y=0
        if(!geometry.boundingBox) geometry.computeBoundingBox();
        geometry.translate(0, -geometry.boundingBox.min.y, 0);
        
        loadedProductMesh = mesh;
        positionProductMesh();
        resolve();
      });
    } else {
      placeCardboardBox(loadGeneration);
      resolve();
    }
  });
}

function placeCardboardBox(loadGeneration) {
  if (loadGeneration !== undefined && loadGeneration !== productLoadGeneration) return;
  const geom = new THREE.BoxGeometry(16, 16, 16);
  const mat = new THREE.MeshStandardMaterial({ color: '#d2b48c', roughness: 0.9, map: null });
  loadedProductMesh = new THREE.Mesh(geom, mat);
  loadedProductMesh.position.y = 8;
  positionProductMesh();
}

function positionProductMesh() {
  if (loadedProductMesh && highlightData) {
    loadedProductMesh.position.x += highlightData.x;
    loadedProductMesh.position.y += highlightData.y;
    loadedProductMesh.position.z += highlightData.z;
    loadedProductMesh.castShadow = true;
    productGroup.add(loadedProductMesh);
  }
}

// ── Scene Generation ──

window.update3DScene = function(highlightedSlot3D) {
  if (!scene || !blueprint) return;
  const renderGeneration = ++sceneGeneration;
  if (window.ASTHAMapModel) blueprint = window.ASTHAMapModel.normalizeBlueprint(blueprint);
  
  disposeObject3D(environmentGroup);
  environmentGroup.clear();

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let hasItems = false;
  
  const checkPoint = (x, z) => {
    if(isNaN(x) || isNaN(z)) return;
    if(x < minX) minX = x;
    if(x > maxX) maxX = x;
    if(z < minZ) minZ = z;
    if(z > maxZ) maxZ = z;
    hasItems = true;
  };

  if (window.ASTHAMapModel) {
    window.ASTHAMapModel.createScenePlan(blueprint).entities.forEach(entity => {
      checkPoint(entity.position.x - (entity.width || 0)/2, entity.position.z - (entity.depth || 0)/2);
      checkPoint(entity.position.x + (entity.width || 0)/2, entity.position.z + (entity.depth || 0)/2);
    });
  }

  const centerX = hasItems ? (minX + maxX) / 2 : 500;
  const centerZ = hasItems ? (minZ + maxZ) / 2 : 500;

  const gridHelper = new THREE.GridHelper(10000, 250, 0x475569, 0x94a3b8);
  gridHelper.position.set(centerX, 0.5, centerZ); // Centered dynamically!
  environmentGroup.add(gridHelper);

  const dimensions = ASTHAMapModel.sceneDimensions(blueprint);
  const WALL_HEIGHT = dimensions.wallHeight;
  const WALL_THICKNESS = 10;
  const FLOOR_HEIGHT = dimensions.floorHeight;


  const wallMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9, side: THREE.DoubleSide });
  const wallSidesMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.9, side: THREE.DoubleSide });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.8, side: THREE.DoubleSide });
  const beamMat = new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });
  const uprightMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide });
  const highlightGlowMat = new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.3, side: THREE.DoubleSide });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#38bdf8', transmission: 0.9, opacity: 1, metalness: 0, roughness: 0.1, ior: 1.5, side: THREE.DoubleSide });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#e0f2fe', roughness: 0.4, side: THREE.DoubleSide });
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7, side: THREE.DoubleSide });

  highlightData = null; 
  const searchLoc = parseLocation(highlightedSlot3D);

  Object.keys(blueprint.floors).forEach(levelStr => {
    const level = parseInt(levelStr);
    const floorY = level * FLOOR_HEIGHT;
    const sourceFloor = blueprint.floors[level];
    const floorData = Object.fromEntries(Object.entries(sourceFloor).map(([key,value]) => [key, Array.isArray(value) ? value.filter(entity => entity.visible !== false) : value]));

    if(floorData.walls) floorData.walls.forEach(w => {
      if (!w || isNaN(w.x1) || isNaN(w.y1) || isNaN(w.x2) || isNaN(w.y2)) return;
      const dx = w.x2 - w.x1;
      const dz = w.y2 - w.y1;
      const length = Math.hypot(dx, dz);
      if (!length || isNaN(length) || length < 1) return;

      // Use robust BoxGeometry instead of ExtrudeGeometry (which silently fails with earcut)
      const wallGeom = new THREE.BoxGeometry(length, w.wallHeight || WALL_HEIGHT, w.wallThickness || WALL_THICKNESS);
      const mesh = new THREE.Mesh(wallGeom, wallMat);
      const angle = Math.atan2(dz, dx);
      // Center the wall between its two endpoints, raised half its height off the floor
      mesh.position.set((w.x1 + w.x2) / 2, floorY + (w.wallHeight || WALL_HEIGHT) / 2, (w.y1 + w.y2) / 2);
      mesh.rotation.y = -angle;

      applyEdges(mesh, '#94a3b8');
      mesh.castShadow = true; mesh.receiveShadow = true;
      environmentGroup.add(mesh);

      // Add a visible stripe along the top edge of every wall for clarity
      const topBarGeom = new THREE.BoxGeometry(length, 4, (w.wallThickness || WALL_THICKNESS) + 2);
      const topBar = new THREE.Mesh(topBarGeom, wallSidesMat);
      topBar.position.set((w.x1 + w.x2) / 2, floorY + (w.wallHeight || WALL_HEIGHT) - 2, (w.y1 + w.y2) / 2);
      topBar.rotation.y = -angle;
      environmentGroup.add(topBar);
    });

    const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.8 });
    if(floorData.doors) floorData.doors.forEach(d => {
      if (!d || isNaN(d.x) || isNaN(d.y)) return;
      const leafGeom = new THREE.BoxGeometry(d.w, d.height3d, d.h);
      leafGeom.translate(d.w/2, d.height3d/2, 0);
      const mesh = new THREE.Mesh(leafGeom, doorFrameMat);
      mesh.position.set(d.x - Math.cos(d.angle||0)*d.w/2, floorY, d.y - Math.sin(d.angle||0)*d.w/2);
      mesh.rotation.y = -(d.angle||0) - Math.PI/4;
      applyEdges(mesh, '#5c3a21');
      mesh.castShadow = true;
      environmentGroup.add(mesh);
    });

    if(floorData.windows) floorData.windows.forEach(win => {
      if (!win || isNaN(win.x) || isNaN(win.y)) return;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(win.w, win.height3d, win.h), glassMat);
      glass.position.set(win.x, floorY + 40 + win.height3d/2, win.y);
      glass.rotation.y = -(win.angle||0);
      applyEdges(glass, '#0284c7');
      environmentGroup.add(glass);
    });

    if(floorData.pillars) floorData.pillars.forEach(p => {
      if (!p || isNaN(p.x) || isNaN(p.y)) return;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.wallHeight || WALL_HEIGHT, p.h), pillarMat);
      mesh.position.set(p.x, floorY + (p.wallHeight || WALL_HEIGHT)/2, p.y);
      mesh.rotation.y = -(p.angle || 0);
      applyEdges(mesh, '#334155');
      mesh.castShadow = true; mesh.receiveShadow = true;
      environmentGroup.add(mesh);
    });

    // Industrial Shelves (Pallet Racks)
    if(floorData.shelves) floorData.shelves.forEach(sh => {
      if (!sh || isNaN(sh.x) || isNaN(sh.y)) return;
      const isShelfMatch = searchLoc.shelfId && sh.id && sh.id.toUpperCase() === searchLoc.shelfId.toUpperCase();
      const rackGroup = new THREE.Group();
      const pW = 4;
      const pD = 4;

      // How many levels the shelf has
      const levelsCount = sh.levels || 3;
      const levelSpacing = ((sh.shelfHeight || 15 + levelsCount * 30) - 15) / levelsCount;
      const baseOffset = 15;
      // Upright height = exactly what this shelf needs (WALL_HEIGHT already accounts for it)
      const pH = sh.shelfHeight || baseOffset + levelsCount * levelSpacing;
      // Build all level Y positions — no limit, WALL_HEIGHT already auto-scaled above
      const levelsY = [];
      for (let i = 0; i < levelsCount; i++) {
        levelsY.push(baseOffset + i * levelSpacing);
      }

      // Four corner uprights
      const cornerPos = [ [0, 0], [sh.w - pW, 0], [0, sh.h - pD], [sh.w - pW, sh.h - pD] ];
      cornerPos.forEach(pos => {
        const pMesh = new THREE.Mesh(new THREE.BoxGeometry(pW, pH, pD), uprightMat);
        pMesh.position.set(pos[0] + pW/2, pH/2, pos[1] + pD/2);
        applyEdges(pMesh, '#1e3a8a');
        pMesh.castShadow = true;
        rackGroup.add(pMesh);
      });

      // Beams & boards — only for levels that fit
      levelsY.forEach(yLevel => {
        const bFront = new THREE.Mesh(new THREE.BoxGeometry(sh.w, 4, 4), beamMat);
        bFront.position.set(sh.w/2, yLevel, 2);
        applyEdges(bFront, '#c2410c');
        bFront.castShadow = true;
        rackGroup.add(bFront);

        const bBack = new THREE.Mesh(new THREE.BoxGeometry(sh.w, 4, 4), beamMat);
        bBack.position.set(sh.w/2, yLevel, sh.h - 2);
        applyEdges(bBack, '#c2410c');
        bBack.castShadow = true;
        rackGroup.add(bBack);

        const board = new THREE.Mesh(
          new THREE.BoxGeometry(sh.w - 4, 1, sh.h - 8),
          new THREE.MeshStandardMaterial({ color: '#94a3b8' })
        );
        board.position.set(sh.w/2, yLevel + 2.5, sh.h/2);
        applyEdges(board, '#475569');
        rackGroup.add(board);
      });

      if(isShelfMatch) {
        const levelIndex = Math.min(Math.max(searchLoc.level - 1, 0), levelsY.length - 1);
        const targetY = levelsY[levelIndex] + 4;
        const slotsCount = sh.positions || Math.max(1, Math.floor(sh.w / 25));
        const slotIndex = Math.min(Math.max(searchLoc.position - 1, 0), slotsCount - 1);
        const slotW = sh.w / slotsCount;
        const targetX = (slotIndex * slotW) + (slotW / 2);
        const shelfYaw=-(sh.angle || 0), localX=targetX-sh.w/2;
        highlightData = { x: sh.x+sh.w/2+Math.cos(shelfYaw)*localX, y: floorY + targetY, z: sh.y+sh.h/2-Math.sin(shelfYaw)*localX };
        const glowBox = new THREE.Mesh(new THREE.BoxGeometry(slotW - 2, 20, sh.h - 6), highlightGlowMat);
        glowBox.position.set(targetX, targetY + 10, sh.h/2);
        rackGroup.add(glowBox);
      }

      // Indexed items (boxes/pallets)
      if (sh.items && sh.items.length > 0) {
        const slotsCount = sh.positions || Math.max(1, Math.floor(sh.w / 25));
        const slotW = sh.w / slotsCount;
        sh.items.forEach(item => {
          const itemLvl = Math.max(1, Math.min(levelsY.length, item.level)) - 1;
          const itemPos = Math.max(1, Math.min(slotsCount, item.position)) - 1;
          const yRest = levelsY[itemLvl] + 4;
          const xCenter = (itemPos * slotW) + (slotW / 2);
          const itemMat = new THREE.MeshStandardMaterial({ color: item.color || '#3b82f6', roughness: 0.6 });
          const boxSize = Math.min(slotW - 4, 24);
          const itemMesh = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxSize, sh.h - 10), itemMat);
          itemMesh.position.set(xCenter, yRest + boxSize/2, sh.h/2);
          itemMesh.castShadow = true;
          applyEdges(itemMesh, '#1e293b');
          rackGroup.add(itemMesh);
        });
      }

      rackGroup.children.forEach(child => { child.position.x-=sh.w/2; child.position.z-=sh.h/2; });
      rackGroup.position.set(sh.x+sh.w/2, floorY, sh.y+sh.h/2);
      rackGroup.rotation.y = -(sh.angle || 0);
      environmentGroup.add(rackGroup);
    });

    for(const addon of floorData.addons||[]){
      if(addon.visible===false||!addon.importId)continue;
      const width=addon.w||addon.width||60,depth=addon.h||addon.height||60,height=addon.height3d||50;
      const object=window.ASTHAMapImports?.create(addon,width,height,depth);
      if(!object)continue;
      object.position.set(addon.x+width/2,floorY+(addon.elevation||0),addon.y+depth/2);object.rotation.y=-(addon.angle||0);environmentGroup.add(object);
    }

    if(floorData.zones) floorData.zones.forEach(z => {
      if (!z || isNaN(z.x1) || isNaN(z.y1) || isNaN(z.x2) || isNaN(z.y2)) return;
      const w = Math.abs(z.x2 - z.x1);
      const h = Math.abs(z.y2 - z.y1);
      if (!w || !h) return;
      const cx = (z.x1 + z.x2) / 2;
      const cy = (z.y1 + z.y2) / 2;
      const zoneMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.3, depthWrite: false });
      const zoneMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), zoneMat);
      zoneMesh.rotation.x = -Math.PI / 2;
      zoneMesh.position.set(cx, floorY + 0.1, cy);
      environmentGroup.add(zoneMesh);
    });

    // Paths
    if(floorData.paths) floorData.paths.forEach(p => {
      if (!p || isNaN(p.x1) || isNaN(p.y1) || isNaN(p.x2) || isNaN(p.y2)) return;
      const dx = p.x2 - p.x1;
      const dz = p.y2 - p.y1;
      const length = Math.hypot(dx, dz);
      if (!length || length < 1) return;
      const pathMat = new THREE.MeshBasicMaterial({ color: 0xeab308, transparent: true, opacity: 0.8, depthWrite: false });
      const pathMesh = new THREE.Mesh(new THREE.PlaneGeometry(length, 8), pathMat); // 8px wide yellow line
      pathMesh.rotation.x = -Math.PI / 2;
      pathMesh.position.set(p.x1 + dx/2, floorY + 0.2, p.y1 + dz/2);
      pathMesh.rotation.z = Math.atan2(dz, dx);
      environmentGroup.add(pathMesh);
    });

    // Stairs
    if(floorData.stairs) floorData.stairs.forEach(s => {
      if (!s || isNaN(s.x1) || isNaN(s.y1) || isNaN(s.x2) || isNaN(s.y2)) return;
      const dx = s.x2 - s.x1;
      const dz = s.y2 - s.y1;
      const length = Math.hypot(dx, dz);
      if (!length || length < 1) return;
      const stairW = s.h || 20;
      
      const steps = Math.floor(length / 10);
      if (steps < 1) return;
      const stairGroup = new THREE.Group();
      
      const stairMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1' });
      for(let i=0; i<steps; i++) {
        const stepH = (i / steps) * (s.height3d || FLOOR_HEIGHT - 10); // Ramp up to next floor
        const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(10, stepH, stairW), stairMat);
        stepMesh.position.set(5 + i*10, stepH/2, 0);
        stepMesh.castShadow = true; stepMesh.receiveShadow = true;
        applyEdges(stepMesh, '#94a3b8');
        stairGroup.add(stepMesh);
      }
      
      stairGroup.position.set(s.x1, floorY, s.y1);
      stairGroup.rotation.y = -Math.atan2(dz, dx);
      environmentGroup.add(stairGroup);
    });

    for (const [collection, type, material] of [
      ['machines','machine',new THREE.MeshStandardMaterial({color:0x64748b,roughness:.7})],
      ['forklifts','forklift',new THREE.MeshStandardMaterial({color:0xf59e0b,roughness:.6})],
      ['docks','dock',new THREE.MeshStandardMaterial({color:0x0ea5e9,roughness:.7})]
    ]) {
      (floorData[collection] || []).forEach(entity => {
        try {
          const w=Math.max(1,entity.w||40), d=Math.max(1,entity.h||30), h=Math.max(1,entity.height3d||30);
          const group=type!=='dock' && window.ASTHAObjectLibrary ? ASTHAObjectLibrary.create(type==='forklift'?'FORKLIFT':entity.machineType,w,h,d,entity) : new THREE.Group();
          if(type==='dock' || !window.ASTHAObjectLibrary) {
          const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
          body.position.y=h/2; group.add(body);
          if(type==='forklift') {
            const mast=new THREE.Mesh(new THREE.BoxGeometry(4,h*1.5,d*.75),uprightMat);
            mast.position.set(w*.38,h*.75,0); group.add(mast);
          }
          }
          group.position.set(entity.x+w/2,floorY+(entity.elevation||0),entity.y+d/2); group.rotation.y=-(entity.angle||0);
          group.userData={mapEntityId:entity.id,mapEntityType:type}; environmentGroup.add(group);
        } catch(error) { console.warn('[CAD3D entity skipped]', entity.id, type, error && error.message); }
      });
    }
  });

  if (window.CadObjectEditor) window.CadObjectEditor.attachScene({scene, camera, renderer, controls, environmentGroup});

  // Camera tracking
  if(highlightData) {
    controls.target.set(highlightData.x, highlightData.y, highlightData.z);
    camera.position.set(highlightData.x + 80, highlightData.y + 60, highlightData.z + 100);
    
    window.highlightSpotlight.position.set(highlightData.x, highlightData.y + 150, highlightData.z);
    window.highlightSpotlight.target.position.set(highlightData.x, highlightData.y, highlightData.z);
    window.highlightSpotlight.target.updateMatrixWorld();
    window.highlightSpotlight.intensity = 2;
  } else {
    window.highlightSpotlight.intensity = 0;
    
    // Only auto-frame when explicitly requested (e.g. after adding a new item)
    // NOT during or after resize/move, to prevent violent camera jumps
    if (window._cadFrameCamera3D && hasItems) {
      window._cadFrameCamera3D = false;
      const sizeX = maxX - minX;
      const sizeZ = maxZ - minZ;
      const maxDim = Math.max(sizeX, sizeZ, 200);
      
      controls.target.set(centerX, 0, centerZ);
      const distance = maxDim * 1.5 + 400;
      camera.position.set(centerX + distance * 0.6, maxDim * 0.8 + 300, centerZ + distance * 0.6);
    } else if (!hasItems && !window._cadCameraEverFramed) {
      // Empty scene on first open
      controls.target.set(500, 0, 500);
      camera.position.set(1500, 2000, 1500);
    }
  } // <-- End of else block
  
  controls.update();
  animate();
}

// ── UI Actions (Maximize & ViewCube) ──
window.toggleMaximize3D = function() {
  const workspace=document.getElementById('cadWorkspace');
  if(!workspace || !workspace.querySelector('.eo-cad-3d'))return;
  const maximized=workspace.classList.toggle('cad-3d-maximized');
  const button=document.getElementById('btn-maximize-3d');
  if(button){button.setAttribute('aria-pressed',String(maximized));button.title=maximized?'Restaurar divisão 2D e 3D':'Maximizar 3D';}
  // Keep the renderer in flex layout. Absolute positioning combined with the
  // split view's width:0 collapsed the WebGL viewport when maximizing.
  requestAnimationFrame(()=>{window.dispatchEvent(new Event('resize'));window.resizeCad3D();});
};

window.setCameraView = function(view) {
  if (!camera || !controls) return;
  
  switch(view) {
    case 'top': camera.position.set(500, 3000, 500); break;
    case 'front': camera.position.set(500, 500, 3000); break;
    case 'back': camera.position.set(500, 500, -2000); break;
    case 'right': camera.position.set(3000, 500, 500); break;
    case 'left': camera.position.set(-2000, 500, 500); break;
    case 'bottom': camera.position.set(500, -2000, 500); break;
  }
  
  controls.target.set(500, 0, 500);
  camera.lookAt(500, 0, 500);
  controls.update();
  animate();
  
  // Rotate CSS Cube
  const cube = document.getElementById('view-cube');
  if (cube) {
    switch(view) {
      case 'top': cube.style.transform = 'rotateX(-90deg) rotateY(0deg)'; break;
      case 'front': cube.style.transform = 'rotateX(0deg) rotateY(0deg)'; break;
      case 'back': cube.style.transform = 'rotateX(0deg) rotateY(180deg)'; break;
      case 'right': cube.style.transform = 'rotateX(0deg) rotateY(-90deg)'; break;
      case 'left': cube.style.transform = 'rotateX(0deg) rotateY(90deg)'; break;
      case 'bottom': cube.style.transform = 'rotateX(90deg) rotateY(0deg)'; break;
    }
  }
}

window.exportCAD = function(format) {
  if (!environmentGroup || environmentGroup.children.length === 0) {
    if(typeof showToast === 'function') showToast('A cena 3D está vazia.', 'error');
    return;
  }
  
  if (format === 'stl') {
    if (typeof THREE.STLExporter === 'undefined') {
      if(typeof showToast === 'function') showToast('STLExporter não carregado.', 'error');
      return;
    }
    const exporter = new THREE.STLExporter();
    const stlString = exporter.parse(environmentGroup);
    const blob = new Blob([stlString], { type: 'text/plain' });
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = URL.createObjectURL(blob);
    const objectUrl = link.href;
    link.download = (blueprint.name || 'planta') + '.stl';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    if(typeof showToast === 'function') showToast('Exportação STL concluída.', 'success');
  } else if (format === 'obj') {
    if (typeof THREE.OBJExporter === 'undefined') {
      if(typeof showToast === 'function') showToast('OBJExporter não carregado.', 'error');
      return;
    }
    const exporter = new THREE.OBJExporter();
    const objString = exporter.parse(environmentGroup);
    const blob = new Blob([objString], { type: 'text/plain' });
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = URL.createObjectURL(blob);
    const objectUrl = link.href;
    link.download = (blueprint.name || 'planta') + '.obj';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    if(typeof showToast === 'function') showToast('Exportação OBJ concluída.', 'success');
  }
}
