/* ============================================================
   Sistema Builder 3D — Architectural & Hierarchical Engine
   ============================================================ */

let scene, camera, renderer, controls;
let container3D;
let environmentGroup;
let productGroup;

let highlightedSlot3D = null;
let highlightedMaterial = null;
let highlightData = null; // Coordinates for placing the product
let loadedProductMesh = null;
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
    camera = new THREE.PerspectiveCamera(35, container3D.clientWidth / container3D.clientHeight, 1, 20000);
    camera.position.set(1500, 2000, 1500); // High up and angled
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container3D.clientWidth, container3D.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container3D.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(500, 0, 500); // Focus point
    camera.lookAt(500, 0, 500);
    controls.update();

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
    
    window.addEventListener('resize', () => {
      if(container3D.clientWidth > 0) {
        camera.aspect = container3D.clientWidth / container3D.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container3D.clientWidth, container3D.clientHeight);
      }
    });
    
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

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  
  const cube = document.getElementById('view-cube');
  if (cube && camera) {
    const e = camera.rotation;
    // We reverse the camera rotation to apply it to the cube, 
    // but the cube needs to be rotated so it shows the faces correctly.
    // CSS uses standard pitch/yaw/roll right-to-left.
    cube.style.transform = `rotateX(${e.x}rad) rotateY(${e.y}rad) rotateZ(${e.z}rad)`;
  }
  
  renderer.render(scene, camera);
}

// ── Item Placement & Highlighting ──

window.highlightSlot3D = async function(slotId, material) {
  highlightedSlot3D = slotId;
  highlightedMaterial = material;
  
  const loc = parseLocation(slotId);
  
  if (hudOverlay && material) {
    hudOverlay.innerHTML = `<span style="font-size:12px;color:#a8b2d1;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Localização Encontrada</span><br><b>Item ${material.desc}</b> em Prateleira <b>${loc.shelfId}</b> &bull; Nível <b>${loc.level}</b> &bull; Pos <b>${loc.position}</b>`;
    hudOverlay.style.display = 'block';
  } else if (hudOverlay) {
    hudOverlay.style.display = 'none';
  }
  
  // Clear previous product
  while(productGroup.children.length > 0) {
    productGroup.remove(productGroup.children[0]);
  }
  loadedProductMesh = null;
  
  update3DScene(); 
  
  if (material && highlightData) {
    try {
      const res = await API.get(`/materials/${material.code}/files`);
      if (res.success && res.data) {
        const prod3D = res.data.find(f => f.category === 'product_3d' && f.filename.match(/\.(stl|obj|gltf|glb)$/i));
        if (prod3D) {
          hudOverlay.innerHTML += `<br><small style="color:#22c55e;font-weight:600;">Baixando modelo 3D real...</small>`;
          await loadProduct3D(prod3D.url, prod3D.filename);
        } else {
          placeCardboardBox();
        }
      } else {
        placeCardboardBox();
      }
    } catch(e) {
      placeCardboardBox();
    }
  } else if (material && !highlightData) {
      hudOverlay.innerHTML += `<br><small style="color:#f59e0b;font-weight:600;">A prateleira ${loc.shelfId} não está desenhada no mapa!</small>`;
  }

  // Cancel any existing timeout
  if(window.hlTimeout) clearTimeout(window.hlTimeout);
  
  window.hlTimeout = setTimeout(() => {
    if(highlightedSlot3D === slotId) {
      highlightedSlot3D = null;
      highlightedMaterial = null;
      highlightData = null;
      if(hudOverlay) hudOverlay.style.display = 'none';
      while(productGroup.children.length > 0) productGroup.remove(productGroup.children[0]);
      update3DScene();
    }
  }, 20000); // 20s display
}

window.cadAutoScaleEnabled = true;
window.toggle3DAutoScale = function(enabled) {
  window.cadAutoScaleEnabled = enabled;
  if(typeof showToast === 'function') showToast(`Auto-Escala 3D ${enabled?'Ativada':'Desativada'}`, 'info');
}

async function loadProduct3D(url, filename) {
  return new Promise((resolve) => {
    if (filename.toLowerCase().endsWith('.stl')) {
      const loader = new THREE.STLLoader();
      loader.load(url, (geometry) => {
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
      placeCardboardBox();
      resolve();
    }
  });
}

function placeCardboardBox() {
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
  
  while (environmentGroup.children.length > 0) {
    const child = environmentGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => {
          if (!mat.isShared) mat.dispose();
        });
      } else if (!child.material.isShared) {
        child.material.dispose();
      }
    }
    environmentGroup.remove(child);
  }

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

  if (blueprint.floors[0].walls) blueprint.floors[0].walls.forEach(w => { 
    if (!w || isNaN(w.x1) || isNaN(w.y1) || isNaN(w.x2) || isNaN(w.y2)) return;
    const length = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (!length || length < 1) return;
    checkPoint(w.x1, w.y1); checkPoint(w.x2, w.y2); 
  });
  
  if (blueprint.floors[0].shelves) blueprint.floors[0].shelves.forEach(sh => { 
    if (!sh || isNaN(sh.x) || isNaN(sh.y)) return;
    checkPoint(sh.x, sh.y); checkPoint(sh.x + sh.w, sh.y + sh.h); 
  });
  
  if (blueprint.floors[0].pillars) blueprint.floors[0].pillars.forEach(p => { 
    if (!p || isNaN(p.x) || isNaN(p.y)) return;
    checkPoint(p.x, p.y); 
  });

  const centerX = hasItems ? (minX + maxX) / 2 : 500;
  const centerZ = hasItems ? (minZ + maxZ) / 2 : 500;

  const gridHelper = new THREE.GridHelper(10000, 250, 0x475569, 0x94a3b8);
  gridHelper.position.set(centerX, 0.5, centerZ); // Centered dynamically!
  environmentGroup.add(gridHelper);

  const WALL_HEIGHT = 120;
  const WALL_THICKNESS = 10;
  const FLOOR_HEIGHT = 140; 

  const wallMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9, side: THREE.DoubleSide });
  const wallSidesMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.9, side: THREE.DoubleSide });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.8, side: THREE.DoubleSide });
  const beamMat = new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });
  const uprightMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide });
  const highlightGlowMat = new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.3, side: THREE.DoubleSide });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#38bdf8', transmission: 0.9, opacity: 1, metalness: 0, roughness: 0.1, ior: 1.5, thickness: 2, side: THREE.DoubleSide });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#e0f2fe', roughness: 0.4, side: THREE.DoubleSide });
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7, side: THREE.DoubleSide });

  highlightData = null; 
  const searchLoc = parseLocation(highlightedSlot3D);

  Object.keys(blueprint.floors).forEach(levelStr => {
    const level = parseInt(levelStr);
    const floorY = level * FLOOR_HEIGHT;
    const floorData = blueprint.floors[level];

    if(floorData.walls) floorData.walls.forEach(w => {
      if (!w || isNaN(w.x1) || isNaN(w.y1) || isNaN(w.x2) || isNaN(w.y2)) return;
      const dx = w.x2 - w.x1;
      const dz = w.y2 - w.y1;
      const length = Math.hypot(dx, dz);
      if (!length || isNaN(length) || length < 1) return; // Prevent zero-length walls from crashing geometry
      
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(length, 0);
      shape.lineTo(length, WALL_HEIGHT);
      shape.lineTo(0, WALL_HEIGHT);
      shape.lineTo(0, 0);
      
      // Doors Cutouts
      if(floorData.doors) floorData.doors.forEach(d => {
        if (!d || isNaN(d.x) || isNaN(d.y)) return;
        const A = {x: w.x1, y: w.y1}, B = {x: w.x2, y: w.y2}, P = {x: d.x, y: d.y};
        const AB2 = (B.x - A.x)**2 + (B.y - A.y)**2;
        if (AB2 === 0) return;
        const t = ((P.x - A.x)*(B.x - A.x) + (P.y - A.y)*(B.y - A.y)) / AB2;
        if (t >= 0 && t <= 1) {
          const projX = A.x + t*(B.x - A.x);
          const projY = A.y + t*(B.y - A.y);
          if (Math.hypot(P.x - projX, P.y - projY) < 30) {
             const offset = t * length;
             const startX = Math.max(0.1, offset - 20);
             const endX = Math.min(length - 0.1, offset + 20);
             if (startX < endX) {
               const hole = new THREE.Path();
               hole.moveTo(startX, 0); 
               hole.lineTo(startX, 90); 
               hole.lineTo(endX, 90); 
               hole.lineTo(endX, 0);
               hole.lineTo(startX, 0);
               shape.holes.push(hole);
             }
          }
        }
      });
      
      // Windows Cutouts
      if(floorData.windows) floorData.windows.forEach(win => {
        if (!win || isNaN(win.x) || isNaN(win.y)) return;
        const A = {x: w.x1, y: w.y1}, B = {x: w.x2, y: w.y2}, P = {x: win.x, y: win.y};
        const AB2 = (B.x - A.x)**2 + (B.y - A.y)**2;
        if (AB2 === 0) return;
        const t = ((P.x - A.x)*(B.x - A.x) + (P.y - A.y)*(B.y - A.y)) / AB2;
        if (t >= 0 && t <= 1) {
          const projX = A.x + t*(B.x - A.x);
          const projY = A.y + t*(B.y - A.y);
          if (Math.hypot(P.x - projX, P.y - projY) < 30) {
             const offset = t * length;
             const startX = Math.max(0.1, offset - 20);
             const endX = Math.min(length - 0.1, offset + 20);
             if (startX < endX) {
               const hole = new THREE.Path();
               hole.moveTo(startX, 40);
               hole.lineTo(startX, 90);
               hole.lineTo(endX, 90);
               hole.lineTo(endX, 40);
               hole.lineTo(startX, 40);
               shape.holes.push(hole);
             }
          }
        }
      });
      
      const extrudeSettings = { depth: WALL_THICKNESS, bevelEnabled: false };
      let geometry;
      try {
        geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      } catch (e) {
        console.warn("Earcut failed (possibly overlapping doors/windows). Retrying without cutouts.", e);
        shape.holes = []; // Remove overlapping holes
        try {
          geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        } catch (e2) {
          console.error("Critical geometry failure on wall", e2);
          return; // Skip this wall completely
        }
      }
      
      geometry.translate(-length/2, 0, -WALL_THICKNESS/2);
      
      const mesh = new THREE.Mesh(geometry, [wallMat, wallSidesMat]);
      const angle = Math.atan2(dz, dx);
      mesh.position.set((w.x1 + w.x2)/2, floorY, (w.y1 + w.y2)/2);
      mesh.rotation.y = -angle;
      
      applyEdges(mesh, '#94a3b8');
      mesh.castShadow = true; mesh.receiveShadow = true;
      environmentGroup.add(mesh);
    });

    const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.8 });
    if(floorData.doors) floorData.doors.forEach(d => {
      if (!d || isNaN(d.x) || isNaN(d.y)) return;
      const leafGeom = new THREE.BoxGeometry(36, 88, 4);
      leafGeom.translate(18, 44, 0);
      const mesh = new THREE.Mesh(leafGeom, doorFrameMat);
      mesh.position.set(d.x - Math.cos(d.angle||0)*18, floorY, d.y - Math.sin(d.angle||0)*18);
      mesh.rotation.y = -(d.angle||0) - Math.PI/4;
      applyEdges(mesh, '#5c3a21');
      mesh.castShadow = true;
      environmentGroup.add(mesh);
    });

    if(floorData.windows) floorData.windows.forEach(win => {
      if (!win || isNaN(win.x) || isNaN(win.y)) return;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(36, 46, 2), glassMat);
      glass.position.set(win.x, floorY + 65, win.y);
      glass.rotation.y = -(win.angle||0);
      applyEdges(glass, '#0284c7');
      environmentGroup.add(glass);
    });

    if(floorData.pillars) floorData.pillars.forEach(p => {
      if (!p || isNaN(p.x) || isNaN(p.y)) return;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.size, WALL_HEIGHT, p.size), pillarMat);
      mesh.position.set(p.x, floorY + WALL_HEIGHT/2, p.y);
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
      const levelsCount = sh.levels || 3;
      const pH = (levelsCount * 30) + 15; // Dynamic height based on levels
      const pD = 4;
      const positions = [ [0, 0], [sh.w - pW, 0], [0, sh.h - pD], [sh.w - pW, sh.h - pD] ];
      
      positions.forEach(pos => {
        const pMesh = new THREE.Mesh(new THREE.BoxGeometry(pW, pH, pD), uprightMat);
        pMesh.position.set(pos[0] + pW/2, pH/2, pos[1] + pD/2);
        applyEdges(pMesh, '#1e3a8a');
        pMesh.castShadow = true;
        rackGroup.add(pMesh);
      });
      
      const levelsY = [];
      for(let i=0; i<levelsCount; i++) {
        levelsY.push(15 + (i * 30));
      }
      
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
        
        const board = new THREE.Mesh(new THREE.BoxGeometry(sh.w - 4, 1, sh.h - 8), new THREE.MeshStandardMaterial({ color: '#94a3b8' }));
        board.position.set(sh.w/2, yLevel + 2.5, sh.h/2);
        applyEdges(board, '#475569');
        rackGroup.add(board);
      });
      
      if(isShelfMatch) {
        // Calculate exact Level and Position Coordinates
        const levelIndex = Math.min(Math.max(searchLoc.level - 1, 0), levelsY.length - 1);
        const targetY = levelsY[levelIndex] + 4; // Right above the board
        
        const slotsCount = sh.positions || Math.max(1, Math.floor(sh.w / 25));
        const slotIndex = Math.min(Math.max(searchLoc.position - 1, 0), slotsCount - 1);
        const slotW = sh.w / slotsCount;
        const targetX = (slotIndex * slotW) + (slotW / 2); // Center of that slot

        highlightData = {
          x: sh.x + targetX,
          y: floorY + targetY,
          z: sh.y + sh.h/2
        };
        
        // Highlight Glow Box (soft green area for the slot)
        const glowBox = new THREE.Mesh(new THREE.BoxGeometry(slotW - 2, 20, sh.h - 6), highlightGlowMat);
        glowBox.position.set(targetX, targetY + 10, sh.h/2);
        rackGroup.add(glowBox);
      }
      
      // Render Indexed Items (Boxes/Pallets)
      if (sh.items && sh.items.length > 0) {
        const slotsCount = sh.positions || Math.max(1, Math.floor(sh.w / 25));
        const slotW = sh.w / slotsCount;
        
        sh.items.forEach(item => {
          const itemLvl = Math.max(1, Math.min(levelsY.length, item.level)) - 1;
          const itemPos = Math.max(1, Math.min(slotsCount, item.position)) - 1;
          
          const yRest = levelsY[itemLvl] + 4; // Right above the board
          const xCenter = (itemPos * slotW) + (slotW / 2);
          
          const itemMat = new THREE.MeshStandardMaterial({ color: item.color || '#3b82f6', roughness: 0.6 });
          const boxSize = Math.min(slotW - 4, 24); // Ensure box fits in slot
          const itemMesh = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxSize, sh.h - 10), itemMat);
          itemMesh.position.set(xCenter, yRest + boxSize/2, sh.h/2);
          itemMesh.castShadow = true;
          applyEdges(itemMesh, '#1e293b');
          rackGroup.add(itemMesh);
        });
      }
      
      rackGroup.position.set(sh.x, floorY, sh.y);
      
      // Pivot for rotation needs to be center of the rack for 2D, but in 2D it's top-left based.
      // Actually, in 2D it rotates around its top-left origin.
      rackGroup.rotation.y = -(sh.angle || 0);
      
      environmentGroup.add(rackGroup);
    });

    // Zones
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
      const stairW = 20;
      
      const steps = Math.floor(length / 10);
      if (steps < 1) return;
      const stairGroup = new THREE.Group();
      
      const stairMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1' });
      for(let i=0; i<steps; i++) {
        const stepH = (i / steps) * (FLOOR_HEIGHT - 10); // Ramp up to next floor
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
  });

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
}

// ── UI Actions (Maximize & ViewCube) ──
window.toggleMaximize3D = function() {
  const container3d = document.querySelector('.eo-cad-3d');
  const container2d = document.querySelector('#cadCanvas2d').parentElement;
  
  if (container3d.style.width === '100%') {
    // Restore
    container3d.style.width = '50%';
    container3d.style.position = 'relative';
    container3d.style.zIndex = '1';
    container2d.style.display = 'block';
  } else {
    // Maximize
    container3d.style.width = '100%';
    container3d.style.position = 'absolute';
    container3d.style.top = '0';
    container3d.style.left = '0';
    container3d.style.zIndex = '50';
    container2d.style.display = 'none';
  }
  
  setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
}

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
    link.download = (blueprint.name || 'planta') + '.stl';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    link.download = (blueprint.name || 'planta') + '.obj';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if(typeof showToast === 'function') showToast('Exportação OBJ concluída.', 'success');
  }
}
