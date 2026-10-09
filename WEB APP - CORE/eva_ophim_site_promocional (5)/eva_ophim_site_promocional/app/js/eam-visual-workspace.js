/* Ficha visual de equipamentos. Todos os textos externos entram por textContent. */
(function () {
  'use strict';
  const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);
  const modelExtensions = new Set(['stl', 'obj', 'gltf', 'glb', 'step', 'stp', 'iges', 'igs']);
  const money = (value, currency = 'BRL') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: /^[A-Z]{3}$/.test(currency || '') ? currency : 'BRL' }).format(Number(value) || 0);
  const severityLabel = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };
  const statusLabel = { active: 'Ativo', inactive: 'Inativo', maintenance: 'Em manutenção', retired: 'Desativado' };
  const extension = file => String(file || '').split('.').pop().toLowerCase();
  const element = (tag, className, label) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined) node.textContent = String(label);
    return node;
  };
  const button = (label, action, className = 'btn btn-secondary btn-sm') => {
    const node = element('button', className, label);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const assetChildren = assetId => (window.eamAssetsForWorkspace || []).filter(item => Number(item.parent_asset_id) === Number(assetId));
  let requestSerial = 0;
  let previewSerial = 0;
  let activeObjectUrl = null;
  let activeViewer = null;
  let activeEditorKeyHandler = null;
  let activeDxfCleanup = null;
  let requestedCreatorAsset = null;
  let requestedExplodedAsset = null;
  let requestedEditorAsset = null;
  let requestedEditorPart = null;
  const activeDocumentUrls = new Set();

  function disposePreview() {
    ++previewSerial;
    if (activeEditorKeyHandler) { document.removeEventListener('keydown', activeEditorKeyHandler, true); activeEditorKeyHandler = null; }
    if (activeViewer) { activeViewer.dispose(); activeViewer = null; }
    if (activeObjectUrl) { URL.revokeObjectURL(activeObjectUrl); activeObjectUrl = null; }
    if (activeDxfCleanup) { activeDxfCleanup(); activeDxfCleanup = null; }
    activeDocumentUrls.forEach(url => URL.revokeObjectURL(url));
    activeDocumentUrls.clear();
  }
  async function bundle(assetId) {
    const [twinResult, spareResult, documentResult, assemblyResult, candidatesResult, rollupResult] = await Promise.all([
      API.get(`/eam/assets/${assetId}/digital-twin`),
      API.get(`/eam/assets/${assetId}/spares`),
      API.get(`/eam/assets/${assetId}/documents`),
      API.get(`/eam/assets/${assetId}/assembly-parts`),
      API.get(`/eam/assets/${assetId}/assembly-candidates`),
      API.get(`/eam/assets/${assetId}/component-rollup`)
    ]);
    if (!twinResult.success) throw new Error(twinResult.error || 'Não foi possível carregar a estrutura do ativo');
    const twin = twinResult.data || {};
    const spares = spareResult.success && Array.isArray(spareResult.data) ? [...spareResult.data] : [];
    const known = new Set(spares.map(row => Number(row.material_id)));
    (twin.positions || []).forEach(position => {
      const id = Number(position.expected_item_id);
      if (!validId(id) || known.has(id) || !position.expected_item_code) return;
      spares.push({ material_id: id, code: position.expected_item_code, description: position.expected_item_description, brand: position.expected_item_brand, sector: position.expected_item_sector, location: position.expected_item_location, stock_quantity: position.expected_item_stock, min_qty: position.expected_item_min, unit_price: position.expected_item_price, currency: position.expected_item_currency });
      known.add(id);
    });
    let candidates = candidatesResult.success && Array.isArray(candidatesResult.data) ? candidatesResult.data : [];
    if (!candidates.length) {
      // A ficha do filho já expõe seus modelos; use-a quando uma API antiga não
      // disponibilizar a listagem de candidatos da montagem.
      const children = assetChildren(assetId);
      const childResults = await Promise.all(children.map(child => API.get(`/eam/assets/${Number(child.id)}/digital-twin`)));
      candidates = childResults.flatMap((result, index) => result.success && Array.isArray(result.data?.visuals)
        ? result.data.visuals.filter(visual => visual.type === '3d_model' && modelExtensions.has(extension(visual.filename))).map(visual => ({
          source_type: 'child_visual', source_id: visual.id, source_asset_id: Number(children[index].id),
          filename: visual.filename, title: `${children[index].asset_code} · ${children[index].name} · ${visual.title}`
        })) : []);
    }
    return {
      twin,
      spares,
      documents: documentResult.success && Array.isArray(documentResult.data) ? documentResult.data : [],
      assembly: assemblyResult.success && Array.isArray(assemblyResult.data) ? assemblyResult.data : [],
      rollup: rollupResult.success && rollupResult.data ? rollupResult.data : null,
      candidates,
      candidateError: !candidatesResult.success && !candidates.length ? candidatesResult.error : null,
      warnings: [spareResult, documentResult, assemblyResult, candidatesResult, rollupResult].filter(result => !result.success).map(result => result.error || 'Dados indisponíveis')
    };
  }
  function showError(target, message) { target.replaceChildren(element('p', 'eam-visual-empty', message)); }
  function stat(label, value, sub) {
    const card = element('div', 'eam-visual-stat');
    card.append(element('span', '', label), element('strong', '', value));
    if (sub) card.append(element('small', '', sub));
    return card;
  }
  function listRow(code, name, info, action) {
    const row = element('div', 'eam-visual-list-row');
    const details = element('div');
    details.append(element('strong', '', code || '—'), element('span', '', name || '—'), element('small', '', info || ''));
    row.append(details, button('Abrir', action));
    return row;
  }
  function selectOptions(select, rows, label, value, text) {
    select.replaceChildren(new Option(label, ''));
    rows.forEach(row => select.add(new Option(text(row), String(value(row)))));
  }
  function syncEditorOptions(data) {
    const modules = Array.isArray(data.twin.modules) ? data.twin.modules : [];
    const positions = Array.isArray(data.twin.positions) ? data.twin.positions : [];
    const moduleLabel = row => `${row.code || '—'} · ${row.name || '—'}`;
    const positionLabel = row => `${row.position_number || '—'} · ${row.name || '—'}`;
    const moduleSelect = document.getElementById('eamPositionModule');
    const moduleParent = document.getElementById('eamModuleParent');
    const visualModule = document.getElementById('eamVisualModule');
    const documentModule = document.getElementById('eamDocumentModule');
    const hotspotPosition = document.getElementById('eamHotspotPosition');
    if (moduleSelect) selectOptions(moduleSelect, modules, 'Sem módulo específico', row => row.id, moduleLabel);
    if (moduleParent) selectOptions(moduleParent, modules, 'Módulo principal', row => row.id, moduleLabel);
    if (visualModule) selectOptions(visualModule, modules, 'Equipamento completo', row => row.id, moduleLabel);
    if (documentModule) selectOptions(documentModule, modules, 'Documento do equipamento completo', row => row.id, moduleLabel);
    if (hotspotPosition) selectOptions(hotspotPosition, positions, 'Vincular a uma posição técnica', row => row.id, positionLabel);
    const materialSelect = document.getElementById('eamPositionMaterial');
    const bomSelect = document.getElementById('eamBomMaterial');
    if (materialSelect && bomSelect) {
      const options = Array.from(bomSelect.options).slice(1).map(option => ({ value: option.value, label: option.textContent }));
      selectOptions(materialSelect, options, 'Vincular peça do estoque', row => row.value, row => row.label);
    }
  }
  function visualUrl(assetId, visual) { return `${API.BASE_URL}/eam/assets/${assetId}/visuals/${Number(visual.id)}/data`; }
  const assemblyKey = part => `${part.source_type || 'equipment_visual'}:${Number(part.source_id || part.visual_id)}`;
  function assemblyUrl(assetId, part) {
    if (part.source_type === 'child_visual') return visualUrl(Number(part.source_asset_id), { id: part.source_id });
    if (part.source_type === 'material_file') return `${API.BASE_URL}/materials/${encodeURIComponent(part.material_code)}/files/${Number(part.source_id)}/data`;
    return visualUrl(assetId, { id: part.visual_id });
  }
  function visualChoice(visuals, mode, moduleId) {
    const filtered = visuals.filter(visual => (moduleId ? Number(visual.module_id) === Number(moduleId) : !visual.module_id));
    const preferred = mode === 'exploded'
      ? filtered.find(visual => visual.type === 'exploded_view')
      : filtered.find(visual => visual.type === '3d_model' && modelExtensions.has(extension(visual.filename))) || filtered.find(visual => ['photo', 'normal_view'].includes(visual.type));
    return preferred || (mode === 'normal' ? filtered.find(visual => imageExtensions.has(extension(visual.filename))) : null);
  }
  async function visualStage(target, assetId, visual, positions, editable, onPosition, onHoverPosition, onLeave) {
    disposePreview();
    const serial = previewSerial;
    target.replaceChildren();
    if (!visual) {
      target.append(element('p', 'eam-visual-empty', 'Nenhuma vista cadastrada. Anexe uma foto, modelo 3D ou imagem explodida na aba Estrutura.'));
      return;
    }
    const ext = extension(visual.filename);
    if (modelExtensions.has(ext)) {
      const viewport = element('div', 'eam-visual-3d');
      viewport.id = 'eamVisualViewport';
      target.append(viewport);
      if (typeof ASTHAViewer3D === 'function') {
        activeViewer = new ASTHAViewer3D(viewport.id, false);
        activeViewer.loadModel(visualUrl(assetId, visual), ext, null, () => showError(target, 'Não foi possível abrir este modelo 3D.'));
        viewport.addEventListener('pointerenter', () => onHoverPosition?.(null));
        viewport.addEventListener('pointerleave', () => onLeave?.());
      } else showError(target, 'Visualizador 3D indisponível.');
      return;
    }
    if (!imageExtensions.has(ext)) {
      target.append(element('p', 'eam-visual-empty', 'Este formato não tem pré-visualização nativa. O arquivo pode ser baixado na aba Documentos.'));
      return;
    }
    try {
      const blob = await fetchEamAttachment(visualUrl(assetId, visual));
      if (!target.isConnected || serial !== previewSerial) return;
      const objectUrl = URL.createObjectURL(blob);
      activeObjectUrl = objectUrl;
      const stage = element('div', 'eam-visual-image-stage');
      const image = element('img');
      image.src = objectUrl;
      image.alt = visual.title || 'Vista do equipamento';
      stage.append(image);
      const result = await API.get(`/eam/assets/${assetId}/visuals/${Number(visual.id)}/hotspots`);
      if (!target.isConnected || serial !== previewSerial) { URL.revokeObjectURL(objectUrl); return; }
      const hotspots = result.success && Array.isArray(result.data) ? result.data : [];
      hotspots.forEach(hotspot => {
        const x = Number(hotspot.x_normalized), y = Number(hotspot.y_normalized);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return;
        const position = positions.find(item => Number(item.id) === Number(hotspot.component_position_id));
        const pin = button(hotspot.callout_number || '●', () => onPosition(position, hotspot), 'eam-visual-pin');
        pin.style.left = `${x * 100}%`;
        pin.style.top = `${y * 100}%`;
        pin.title = hotspot.label || position?.name || 'Ponto técnico';
        pin.addEventListener('pointerenter', () => onHoverPosition?.(position));
        pin.addEventListener('pointerleave', () => onLeave?.());
        stage.append(pin);
      });
      if (editable) {
        image.classList.add('eam-visual-pickable');
        image.addEventListener('click', event => {
          const box = image.getBoundingClientRect();
          document.getElementById('eamHotspotAssetId').value = String(assetId);
          document.getElementById('eamHotspotVisualId').value = String(visual.id);
          document.getElementById('eamHotspotX').value = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)).toFixed(4);
          document.getElementById('eamHotspotY').value = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)).toFixed(4);
          document.getElementById('eamHotspotLabel')?.focus();
        });
      }
      target.replaceChildren(stage);
    } catch (error) { showError(target, error.message || 'Falha ao abrir a imagem'); }
  }
  function parseModel(buffer, ext) {
    if (['step', 'stp', 'iges', 'igs'].includes(ext)) return EamCadImport.parse(buffer, ext);
    if (ext === 'stl') return Promise.resolve(new THREE.Mesh(new THREE.STLLoader().parse(buffer), new THREE.MeshStandardMaterial({ color: 0x526f8c, metalness: .18, roughness: .58 })));
    if (ext === 'obj') return Promise.resolve(new THREE.OBJLoader().parse(new TextDecoder().decode(buffer)));
    if (ext === 'gltf' || ext === 'glb') return new Promise((resolve, reject) => new THREE.GLTFLoader().parse(buffer, '', gltf => resolve(gltf.scene), reject));
    return Promise.reject(new Error('Formato 3D não reconhecido'));
  }
  function contrastModel(root, index) {
    const palette = [0x496b89, 0x987050, 0x587d74, 0x745f8e, 0x8b685f];
    root.traverse(child => {
      if (!child.isMesh) return;
      const tint = material => {
        if (!material?.color || material.map || material.vertexColors) return material;
        const channels = [material.color.r, material.color.g, material.color.b];
        if (Math.min(...channels) < .35 || Math.max(...channels) - Math.min(...channels) > .14) return material;
        const replacement = material.clone();
        replacement.color.setHex(palette[index % palette.length]);
        if ('metalness' in replacement) replacement.metalness = .16;
        if ('roughness' in replacement) replacement.roughness = .57;
        return replacement;
      };
      child.material = Array.isArray(child.material) ? child.material.map(tint) : tint(child.material);
    });
  }
  async function compositeStage(target, assetId, parts, mode, positions, onPosition, onPart, editable, onHoverPart, onLeave) {
    disposePreview();
    target.replaceChildren();
    if (typeof ASTHAViewer3D !== 'function' || typeof THREE === 'undefined') return showError(target, 'Visualizador 3D indisponível.');
    const viewport = element('div', 'eam-visual-3d');
    viewport.id = 'eamVisualViewport';
    target.append(viewport);
    const viewer = new ASTHAViewer3D(viewport.id, false);
    activeViewer = viewer;
    viewer.modelGroup = new THREE.Group();
    viewer.scene.add(viewer.modelGroup);
    const modelGroup = new THREE.Group();
    const assembled = [];
    const results = await Promise.allSettled(parts.map(async (part, index) => {
      const ext = extension(part.filename);
      if (!modelExtensions.has(ext)) throw new Error('Formato 3D não renderizável');
      const source = await fetchEamAttachment(assemblyUrl(assetId, part));
      const mesh = await parseModel(await source.arrayBuffer(), ext);
      contrastModel(mesh, index);
      const origin = new THREE.Vector3(Number(part.tx) || 0, Number(part.ty) || 0, Number(part.tz) || 0);
      const explode = new THREE.Vector3(Number(part.explode_dx) || 0, Number(part.explode_dy) || 0, Number(part.explode_dz) || 0);
      mesh.position.copy(origin);
      mesh.rotation.set(THREE.MathUtils.degToRad(Number(part.rx) || 0), THREE.MathUtils.degToRad(Number(part.ry) || 0), THREE.MathUtils.degToRad(Number(part.rz) || 0));
      mesh.scale.setScalar(Number(part.scale_factor) || 1);
      mesh.userData.positionId = Number(part.component_position_id) || null;
      mesh.userData.sourceKey = assemblyKey(part);
      mesh.userData.assemblyPart = part;
      mesh.userData.partTitle = part.display_title || part.title || part.filename;
      mesh.userData.partSummary = part.hover_summary || '';
      if (part.anchor_x != null && part.anchor_y != null && part.anchor_z != null) {
        const markerSize = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).length() * .012 / (Number(part.scale_factor) || 1);
        const marker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(markerSize, .01), 12, 10), new THREE.MeshStandardMaterial({ color: 0x1674df, emissive: 0x0753a2, emissiveIntensity: .35 }));
        marker.position.set(Number(part.anchor_x), Number(part.anchor_y), Number(part.anchor_z));
        mesh.add(marker);
      }
      assembled.push({ mesh, origin, explode, index });
      modelGroup.add(mesh);
    }));
    if (!target.isConnected || activeViewer !== viewer) { viewer.dispose(); return; }
    if (!assembled.length) { disposePreview(); return showError(target, results.find(result => result.status === 'rejected')?.reason?.message || 'Nenhuma parte 3D pôde ser carregada.'); }
    assembled.sort((a, b) => a.index - b.index);
    // Arquivos CAD podem estar em metros, milímetros ou polegadas. Um
    // deslocamento fixo não pode determinar o enquadramento da montagem.
    const normalBounds = new THREE.Box3();
    assembled.forEach(item => normalBounds.expandByObject(item.mesh));
    const size = normalBounds.getSize(new THREE.Vector3());
    const modelSize = Math.max(size.x, size.y, size.z, 0.001);
    const maxOffset = Math.max(...assembled.map(item => item.explode.length()), 0);
    const offsetScale = maxOffset > modelSize * 8 ? modelSize / maxOffset : maxOffset > 0 && maxOffset < modelSize * .45 ? modelSize * .75 / maxOffset : 1;
    assembled.forEach(item => {
      item.explode.multiplyScalar(offsetScale);
      if (maxOffset === 0 && assembled.length > 1) item.explode.set((item.index - (assembled.length - 1) / 2) * modelSize * .8, 0, 0);
      item.mesh.position.copy(item.origin);
    });
    viewer._finishSetup(modelGroup, 'gltf');
    const framing = new THREE.Box3();
    assembled.forEach(item => {
      const bounds = new THREE.Box3().setFromObject(item.mesh);
      framing.union(bounds);
      framing.union(bounds.clone().translate(item.explode));
    });
    const center = framing.getCenter(new THREE.Vector3());
    const radius = Math.max(framing.getBoundingSphere(new THREE.Sphere()).radius, modelSize * .5);
    const direction = viewer.camera.position.clone().sub(viewer.controls.target).normalize();
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(viewer.camera.fov / 2)) * 1.12;
    viewer.camera.position.copy(center).addScaledVector(direction, distance);
    viewer.camera.near = Math.max(.00001, distance / 1000);
    viewer.camera.updateProjectionMatrix();
    viewer.controls.target.copy(center);
    viewer.controls.update();
    const range = element('input', 'eam-explode-range');
    range.type = 'range'; range.min = '0'; range.max = '100'; range.value = '0';
    range.setAttribute('aria-label', 'Distância da vista explodida');
    const percentage = element('output', '', '0%');
    const setSeparation = value => {
      const progress = Math.max(0, Math.min(1, value));
      range.value = String(Math.round(progress * 100));
      percentage.textContent = `${range.value}%`;
      assembled.forEach(item => item.mesh.position.copy(item.origin).addScaledVector(item.explode, progress));
    };
    let animation = 0;
    range.addEventListener('input', () => { cancelAnimationFrame(animation); setSeparation(Number(range.value) / 100); });
    const slider = element('label', 'eam-explode-control');
    slider.append(element('span', '', 'Separação das peças'), range, percentage);
    slider.hidden = mode !== 'exploded';
    target.append(slider);
    if (mode === 'exploded' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const started = performance.now();
      const animate = now => {
        if (activeViewer !== viewer) return;
        const progress = Math.min(1, (now - started) / 1100);
        setSeparation(progress * progress * (3 - 2 * progress));
        if (progress < 1) animation = requestAnimationFrame(animate);
      };
      animation = requestAnimationFrame(animate);
    } else setSeparation(mode === 'exploded' ? 1 : 0);
    const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
    const canvas = viewer.renderer.domElement;
    const tooltip = element('div', 'eam-visual-part-tooltip');
    tooltip.hidden = true;
    viewport.append(tooltip);
    let transformMode = 'move', selectedMesh = null;
    const toolButtons = new Map();
    const toolsBar = editable ? element('div', 'eam-3d-tools') : null;
    function setTransformMode(next) {
      transformMode = next;
      toolButtons.forEach((control, key) => control.classList.toggle('active', key === next));
      canvas.style.cursor = next === 'move' ? 'grab' : 'crosshair';
    }
    if (toolsBar) {
      [['move', 'Mover · G'], ['rotate', 'Girar · R'], ['scale', 'Escalar · S']].forEach(([key, label]) => {
        const control = button(label, () => { setTransformMode(key); canvas.focus({ preventScroll: true }); }, 'eam-3d-tool');
        toolButtons.set(key, control);
        toolsBar.append(control);
      });
      viewport.append(toolsBar);
      setTransformMode('move');
    }
    const axisSelect = editable ? element('select', 'eam-3d-axis-select') : null;
    if (axisSelect) {
      axisSelect.setAttribute('aria-label', 'Eixo para mover ou girar a peça');
      [['free', 'Plano da tela'], ['x', 'Eixo X'], ['y', 'Eixo Y'], ['z', 'Eixo Z']].forEach(([value, label]) => axisSelect.add(new Option(label, value)));
      const axisControl = element('label', 'eam-3d-axis-control');
      axisControl.append(element('span', '', 'Eixo'), axisSelect);
      viewport.append(axisControl);
    }
    if (editable) {
      canvas.tabIndex = 0;
      canvas.setAttribute('aria-label', 'Editor da montagem 3D. G mover, R girar, S escalar, X Y Z selecionar eixo, Enter salvar.');
      const shortcutHelp = element('p', 'eam-3d-shortcut-help', 'G mover · R girar · S escalar · X/Y/Z eixo · Enter salvar · Esc cancelar');
      viewport.append(shortcutHelp);
    }
    let hovered = null, outline = null, originalMaterials = [], drag = null, suppressClick = false;
    function pick(event) {
      const box = viewer.renderer.domElement.getBoundingClientRect();
      pointer.x = (event.clientX - box.left) / box.width * 2 - 1;
      pointer.y = -(event.clientY - box.top) / box.height * 2 + 1;
      raycaster.setFromCamera(pointer, viewer.camera);
      const hit = raycaster.intersectObjects(modelGroup.children, true)[0];
      let current = hit?.object;
      while (current && current !== modelGroup && !current.userData.sourceKey) current = current.parent;
      return { current: current?.userData.sourceKey ? current : null, hit, box };
    }
    function clearHover() {
      originalMaterials.forEach(([mesh, material]) => {
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(item => item?.dispose());
        mesh.material = material;
      });
      originalMaterials = [];
      if (outline) { viewer.scene.remove(outline); outline.geometry.dispose(); outline.material.dispose(); outline = null; }
      hovered = null;
      tooltip.hidden = true;
      canvas.style.cursor = '';
      onLeave?.();
    }
    function showHover(current, event, box) {
      if (current !== hovered) {
        clearHover();
        if (!current) return;
        hovered = current;
        onHoverPart?.(current.userData.assemblyPart);
        current.traverse(mesh => {
          if (!mesh.isMesh || !mesh.material) return;
          const original = mesh.material;
          const brighten = material => {
            const copy = material.clone();
            if (copy.color) copy.color.lerp(new THREE.Color(0x2384de), .48);
            if (copy.emissive) { copy.emissive.setHex(0x1267aa); copy.emissiveIntensity = .28; }
            return copy;
          };
          mesh.material = Array.isArray(original) ? original.map(brighten) : brighten(original);
          originalMaterials.push([mesh, original]);
        });
        outline = new THREE.BoxHelper(current, 0x1674df);
        viewer.scene.add(outline);
      }
      if (!current) return;
      outline?.update();
      tooltip.replaceChildren(element('strong', '', current.userData.partTitle || 'Parte 3D'));
      if (current.userData.partSummary) tooltip.append(element('span', '', current.userData.partSummary));
      tooltip.hidden = false;
      tooltip.style.left = `${Math.max(8, Math.min(event.clientX - box.left + 14, box.width - tooltip.offsetWidth - 8))}px`;
      tooltip.style.top = `${Math.max(8, event.clientY - box.top - 34)}px`;
      canvas.style.cursor = editable ? transformMode === 'move' ? 'grab' : 'crosshair' : 'pointer';
    }
    function selectInEditor(current, hit) {
      const selector = document.querySelector('#eamAssetWorkspace .eam-assembly-transform-form select');
      if (!editable || !selector || !current) return false;
      const disclosure = selector.closest('details');
      if (disclosure) disclosure.open = true;
      selector.value = current.userData.sourceKey;
      selector.dispatchEvent(new Event('change'));
      selectedMesh = current;
      onPart(current.userData.assemblyPart);
      const item = assembled.find(entry => entry.mesh === current);
      if (item) ['x', 'y', 'z'].forEach(axis => {
        const field = mode === 'exploded' ? `explode_d${axis}` : `t${axis}`;
        const input = document.querySelector(`#eamAssetWorkspace [data-assembly-field="${field}"]`);
        if (input) input.value = (mode === 'exploded' ? item.explode[axis] : item.origin[axis]).toFixed(4);
      });
      if (item) {
        ['x', 'y', 'z'].forEach(axis => {
          const input = document.querySelector(`#eamAssetWorkspace [data-assembly-field="r${axis}"]`);
          if (input) input.value = THREE.MathUtils.radToDeg(item.mesh.rotation[axis]).toFixed(4);
        });
        const scaleInput = document.querySelector('#eamAssetWorkspace [data-assembly-field="scale_factor"]');
        if (scaleInput) scaleInput.value = item.mesh.scale.x.toFixed(4);
      }
      if (hit) {
        current.updateWorldMatrix(true, false);
        const anchor = current.worldToLocal(hit.point.clone());
        ['x', 'y', 'z'].forEach(axis => { const input = document.querySelector(`#eamAssetWorkspace [data-assembly-anchor="${axis}"]`); if (input) input.value = anchor[axis].toFixed(4); });
      }
      const feedback = document.querySelector('#eamAssetWorkspace .eam-assembly-anchor-feedback');
      if (feedback) feedback.textContent = mode === 'exploded'
        ? 'Parte selecionada. Arraste para ajustar a separação e salve a posição.'
        : 'Parte selecionada. Arraste para ajustar a montagem normal e salve a posição.';
      return true;
    }
    canvas.addEventListener('pointermove', event => {
      if (drag) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4 && !drag.moved) return;
        drag.moved = true;
        if (drag.transformMode === 'rotate') {
          const axis = axisSelect?.value === 'free' ? 'y' : axisSelect.value;
          drag.item.mesh.rotation.copy(drag.startRotation);
          drag.item.mesh.rotation[axis] += THREE.MathUtils.degToRad((event.clientX - drag.startX) * .55);
          outline?.update();
        } else if (drag.transformMode === 'scale') {
          const factor = Math.max(.0001, Math.min(1000000, drag.startScale * Math.exp((drag.startY - event.clientY) * .008)));
          drag.item.mesh.scale.setScalar(factor);
          outline?.update();
        } else {
          pick(event);
          const point = new THREE.Vector3();
          if (!raycaster.ray.intersectPlane(drag.plane, point)) return;
          const delta = point.sub(drag.startPoint);
          if (axisSelect && axisSelect.value !== 'free') {
            if (axisSelect.value !== 'x') delta.x = 0;
            if (axisSelect.value !== 'y') delta.y = 0;
            if (axisSelect.value !== 'z') delta.z = 0;
          }
          (mode === 'exploded' ? drag.item.explode : drag.item.origin).copy(drag.startOffset).add(delta);
          setSeparation(mode === 'exploded' ? 1 : 0);
          outline?.update();
        }
        return;
      }
      const { current, box } = pick(event);
      showHover(current, event, box);
    });
    canvas.addEventListener('pointerleave', () => { if (!drag) clearHover(); });
    if (editable) {
      canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const { current, hit } = pick(event);
        const item = assembled.find(entry => entry.mesh === current);
        if (!item || !hit) return;
        canvas.focus({ preventScroll: true });
        selectInEditor(current, hit);
        cancelAnimationFrame(animation);
        setSeparation(mode === 'exploded' ? 1 : 0);
        const normal = viewer.camera.getWorldDirection(new THREE.Vector3());
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point);
        drag = { item, current, hit, plane, transformMode, startPoint: hit.point.clone(), startOffset: (mode === 'exploded' ? item.explode : item.origin).clone(), startRotation: item.mesh.rotation.clone(), startScale: item.mesh.scale.x, startX: event.clientX, startY: event.clientY, moved: false };
        viewer.controls.enabled = false;
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener('pointerup', event => {
        if (!drag) return;
        viewer.controls.enabled = true;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (drag.moved) {
          selectInEditor(drag.current, null);
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 0);
        }
        drag = null;
      });
      canvas.addEventListener('pointercancel', () => {
        if (drag) {
          (mode === 'exploded' ? drag.item.explode : drag.item.origin).copy(drag.startOffset);
          drag.item.mesh.rotation.copy(drag.startRotation);
          drag.item.mesh.scale.setScalar(drag.startScale);
        }
        setSeparation(mode === 'exploded' ? 1 : 0);
        drag = null;
        viewer.controls.enabled = true;
      });
      activeEditorKeyHandler = event => {
        if (activeViewer !== viewer || document.activeElement !== canvas || event.ctrlKey || event.metaKey || event.altKey) return;
        const key = event.key.toLowerCase();
        if (['g', 'r', 's'].includes(key)) { event.preventDefault(); setTransformMode({ g: 'move', r: 'rotate', s: 'scale' }[key]); }
        else if (['x', 'y', 'z'].includes(key) && axisSelect) { event.preventDefault(); axisSelect.value = key; }
        else if (key === 'enter' && selectedMesh) {
          event.preventDefault();
          document.querySelector('#eamAssetWorkspace .eam-assembly-transform-form')?.requestSubmit();
        } else if (key === 'escape') {
          event.preventDefault(); event.stopImmediatePropagation();
          if (drag) {
            (mode === 'exploded' ? drag.item.explode : drag.item.origin).copy(drag.startOffset);
            drag.item.mesh.rotation.copy(drag.startRotation);
            drag.item.mesh.scale.setScalar(drag.startScale);
            setSeparation(mode === 'exploded' ? 1 : 0);
            drag = null;
            viewer.controls.enabled = true;
          } else { setTransformMode('move'); if (axisSelect) axisSelect.value = 'free'; }
        }
      };
      document.addEventListener('keydown', activeEditorKeyHandler, true);
    }
    canvas.addEventListener('click', event => {
      if (suppressClick) return;
      const { current, hit } = pick(event);
      if (current?.userData.sourceKey) {
        if (selectInEditor(current, hit)) return;
      }
      if (current?.userData.positionId) onPosition(positions.find(position => Number(position.id) === current.userData.positionId));
      else if (current?.userData.assemblyPart) onPart(current.userData.assemblyPart);
    });
    if (editable && requestedEditorPart?.assetId === assetId) {
      const selected = assembled.find(item => item.mesh.userData.sourceKey === requestedEditorPart.key);
      if (selected) selectInEditor(selected.mesh, null);
      requestedEditorPart = null;
    }
    if (results.some(result => result.status === 'rejected')) target.append(element('p', 'eam-visual-warning', 'Algumas partes não puderam ser carregadas; revise os modelos da montagem.'));
  }
  function positionAction(target, asset, position) {
    if (position?.expected_item_id) return renderPart(target, asset, Number(position.expected_item_id));
    const message = position ? `${position.position_number} · ${position.name}: nenhuma peça de estoque foi vinculada a esta posição.` : 'Este ponto ainda não está vinculado a uma posição técnica.';
    showToast(message, 'info');
  }
  function showPositionCard(stage, target, asset, position, spares) {
    stage.querySelector('.eam-position-card')?.remove();
    const card = element('div', 'eam-position-card');
    if (!position) { card.append(element('strong', '', 'Ponto técnico sem peça vinculada')); stage.append(card); return; }
    const spare = spares.find(item => Number(item.material_id) === Number(position.expected_item_id));
    card.append(element('strong', '', `${position.position_number || '—'} · ${position.name || 'Componente'}`));
    const shortage = spare && Number(spare.stock_quantity) < Number(spare.min_qty || 0);
    card.append(element('span', '', spare ? `${spare.code} · estoque ${spare.stock_quantity ?? '—'} · mínimo ${spare.min_qty ?? '—'} · ${shortage ? 'Abaixo do mínimo' : 'Disponível'}` : 'Sem peça de reposição vinculada'));
    if (position.expected_item_id) card.append(button('Abrir ficha da peça', () => positionAction(target, asset, position), 'btn btn-primary btn-sm'));
    stage.append(card);
  }
  function assemblySources(data) {
    const own = (data.twin.visuals || []).filter(visual => visual.type === '3d_model' && modelExtensions.has(extension(visual.filename)))
      .map(visual => ({ ...visual, source_type: 'equipment_visual', source_id: visual.id }));
    return [...own, ...(data.candidates || [])];
  }
  async function createAssembly(asset, data, sources) {
    let created = 0;
    for (const [index, source] of sources.entries()) {
      const payload = { source_type: source.source_type, source_id: Number(source.source_id), explode_dx: (data.assembly.length + index) * 3, scale_factor: 1 };
      if (source.source_type === 'equipment_visual') payload.visual_id = Number(source.source_id);
      const endpoint = source.source_type === 'equipment_visual' ? 'assembly-parts' : 'assembly-sources';
      const result = await API.post(`/eam/assets/${Number(asset.id)}/${endpoint}`, payload);
      if (!result.success) { showToast(result.error || `Falha ao adicionar ${source.title || source.filename}`, 'error'); break; }
      created++;
    }
    if (created) {
      requestedExplodedAsset = Number(asset.id);
      showToast(`${created} parte(s) adicionada(s) à vista explodida`, 'success');
      refresh(asset.id);
    }
    return created;
  }
  function visualPanel(asset, data, target, editable) {
    const visuals = Array.isArray(data.twin.visuals) ? data.twin.visuals : [];
    const positions = Array.isArray(data.twin.positions) ? data.twin.positions : [];
    const panel = element('section', 'eam-visual-panel');
    const toolbar = element('div', 'eam-visual-toolbar');
    const title = element('h4', '', 'Visualização do equipamento');
    const stage = element('div', 'eam-visual-stage');
    const inspector = element('aside', 'eam-visual-inspector');
    const componentRows = data.rollup?.components || data.spares;
    let selectedPart = null;
    function partDetails(part) {
      if (!part) return { kind: 'Equipamento', title: asset.name || 'Equipamento', code: asset.asset_code || '—', description: asset.description || 'Passe o mouse sobre uma peça da montagem para ver seus dados.', owner: asset };
      if (part.source_type === 'child_visual') {
        const child = (data.rollup?.descendants || []).find(item => Number(item.id) === Number(part.source_asset_id)) || (window.eamAssetsForWorkspace || []).find(item => Number(item.id) === Number(part.source_asset_id));
        return { kind: 'Máquina filha', title: child?.name || part.title || 'Componente', code: child?.asset_code || '—', description: child?.description || `Parte da montagem de ${asset.name}.`, status: child?.status, criticality: child?.criticality, manufacturer: child?.manufacturer, model: child?.model, owner: child };
      }
      if (part.source_type === 'material_file') {
        const material = componentRows.find(item => Number(item.material_id) === Number(part.material_id));
        const owner = (window.eamAssetsForWorkspace || []).find(item => Number(item.id) === Number(material?.asset_id))
          || (validId(material?.asset_id) ? { id: Number(material.asset_id), asset_code: material.asset_code, name: material.asset_name } : asset);
        return { kind: 'Peça de reposição', title: material?.description || part.title || 'Peça', code: material?.code || part.material_code || '—', description: `Aplicação: ${material?.asset_name || owner.name || asset.name}.`, manufacturer: material?.brand, stock: material?.stock_quantity, minimum: material?.min_qty, quantity: material?.quantity, materialId: Number(part.material_id), owner };
      }
      return { kind: 'Modelo do equipamento', title: part.title || asset.name, code: asset.asset_code || '—', description: asset.description || 'Modelo 3D cadastrado para este equipamento.', owner: asset };
    }
    function infoRow(label, value) {
      const row = element('div', 'eam-visual-info-row');
      row.append(element('span', '', label), element('strong', '', value ?? '—'));
      return row;
    }
    function renderInfo(part, hovered = false) {
      const info = partDetails(part);
      inspector.replaceChildren(element('span', 'eam-visual-inspector-kicker', hovered ? 'PEÇA EM DESTAQUE' : info.kind.toUpperCase()), element('h4', '', info.title), element('p', 'eam-visual-inspector-description', info.description));
      inspector.append(infoRow('Código', info.code));
      if (info.manufacturer) inspector.append(infoRow('Fabricante / marca', info.manufacturer));
      if (info.model) inspector.append(infoRow('Modelo', info.model));
      if (info.quantity != null) inspector.append(infoRow('Na montagem', `${info.quantity} un.`));
      if (info.stock != null) inspector.append(infoRow('Em estoque', `${info.stock} un.`));
      if (info.minimum != null) inspector.append(infoRow('Estoque mínimo', `${info.minimum} un.`));
      if (info.status) inspector.append(infoRow('Status', statusLabel[info.status] || info.status));
      if (info.criticality) inspector.append(infoRow('Criticidade', severityLabel[info.criticality] || info.criticality));
      if (!part) inspector.append(infoRow('Máquinas filhas', data.rollup?.descendants?.length ?? assetChildren(asset.id).length), infoRow('Componentes totais', data.rollup?.total_components ?? data.assembly.length));
      if (info.materialId && validId(info.materialId)) inspector.append(button('Abrir ficha da peça', () => renderPart(target, info.owner, info.materialId), 'btn btn-primary btn-sm'));
      else if (part?.source_type === 'child_visual' && info.owner) inspector.append(button('Abrir máquina filha', () => openEamAssetWorkspace(info.owner), 'btn btn-primary btn-sm'));
      if (data.assembly.length) {
        const list = element('div', 'eam-visual-inspector-list');
        list.append(element('strong', '', 'Peças da montagem'));
        data.assembly.forEach((item, index) => list.append(button(`${index + 1}. ${partDetails(item).title}`, () => { selectedPart = item; renderInfo(item); }, `eam-visual-inspector-part${selectedPart && assemblyKey(item) === assemblyKey(selectedPart) ? ' active' : ''}`)));
        inspector.append(list);
      }
    }
    renderInfo(null);
    const assemblyParts = data.assembly.map(part => {
      const info = partDetails(part);
      return { ...part, display_title: `${info.code} · ${info.title}`, hover_summary: info.stock != null
        ? `${info.kind} · estoque ${info.stock} un. · montagem ${info.quantity ?? '—'} un.`
        : info.status ? `${info.kind} · ${statusLabel[info.status] || info.status} · ${severityLabel[info.criticality] || info.criticality || '—'}`
          : info.kind };
    });
    let editActive = editable && requestedEditorAsset === Number(asset.id);
    const normal = button('Vista normal', () => choose('normal'));
    const originalVisual = visualChoice(visuals, 'normal');
    const original = data.assembly.length && originalVisual ? button('Imagem / modelo original', () => choose('original')) : null;
    const hasExploded = data.assembly.length > 0 || Boolean(visualChoice(visuals, 'exploded'));
    const exploded = button(hasExploded ? 'Vista explodida' : 'Criar vista explodida', async () => {
      if (hasExploded) { choose('exploded'); return; }
      const sources = assemblySources(data).filter(source => source.source_type !== 'equipment_visual');
      if (sources.length) {
        exploded.disabled = true;
        const created = await createAssembly(asset, data, sources);
        if (!created) exploded.disabled = false;
        return;
      }
      requestedCreatorAsset = Number(asset.id);
      const structureTab = [...document.querySelectorAll('#eamAssetWorkspace .eam-workspace-tab')].find(tab => tab.textContent === 'Estrutura');
      if (structureTab) structureTab.click();
      else renderAssembly(target, asset);
    });
    const openFull = button('Tela cheia 3D', () => {
      if (data.assembly.length && panel.requestFullscreen) {
        panel.requestFullscreen().then(() => activeViewer?.resize()).catch(() => showToast('Não foi possível abrir em tela cheia', 'error'));
        return;
      }
      const visual = visualChoice(visuals, 'normal');
      if (visual && modelExtensions.has(extension(visual.filename))) open3DViewer(visualUrl(asset.id, visual), extension(visual.filename), visual.title);
    });
    const editButton = data.assembly.length ? button(editActive ? 'Concluir edição' : 'Editar vista explodida', () => {
      if (!editable) {
        requestedEditorAsset = Number(asset.id);
        requestedExplodedAsset = Number(asset.id);
        const structureTab = [...document.querySelectorAll('#eamAssetWorkspace .eam-workspace-tab')].find(tab => tab.textContent === 'Estrutura');
        if (structureTab) structureTab.click();
        return;
      }
      editActive = !editActive;
      requestedEditorAsset = editActive ? Number(asset.id) : null;
      editButton.textContent = editActive ? 'Concluir edição' : 'Editar vista explodida';
      editButton.classList.toggle('active', editActive);
      if (editHint) editHint.hidden = !editActive;
      const editor = panel.closest('.eam-assembly-layout')?.querySelector('.eam-assembly-transform-form')?.closest('details');
      if (editor) editor.open = editActive;
      choose('exploded');
    }, 'btn btn-secondary btn-sm eam-edit-exploded') : null;
    if (editButton) editButton.classList.toggle('active', editActive);
    const editHint = editable && data.assembly.length
      ? element('p', 'eam-visual-edit-hint', 'Passe o mouse para identificar a peça. Clique para selecionar; use G para mover, R para girar, S para escalar e X/Y/Z para escolher o eixo. Arraste a peça e pressione Enter para salvar.')
      : null;
    if (editHint) editHint.hidden = !editActive;
    panel.addEventListener('fullscreenchange', () => activeViewer?.resize());
    function choose(mode) {
      const selected = visualChoice(visuals, mode === 'original' ? 'normal' : mode);
      const composite = data.assembly.length > 0 && mode !== 'original';
      normal.classList.toggle('active', mode === 'normal');
      exploded.classList.toggle('active', mode === 'exploded');
      original?.classList.toggle('active', mode === 'original');
      openFull.disabled = !composite && !visuals.some(visual => visual.type === '3d_model' && modelExtensions.has(extension(visual.filename)));
      if (composite) compositeStage(stage, Number(asset.id), assemblyParts, mode, positions,
        position => { showPositionCard(stage, target, asset, position, data.spares); if (position) renderInfo({ source_type: 'material_file', material_id: Number(position.expected_item_id), title: position.name }); },
        part => { selectedPart = part; renderInfo(part); }, editActive,
        part => renderInfo(part, true), () => renderInfo(selectedPart));
      else visualStage(stage, Number(asset.id), selected, positions, editable,
        position => { showPositionCard(stage, target, asset, position, data.spares); if (position) renderInfo({ source_type: 'material_file', material_id: Number(position.expected_item_id), title: position.name }); },
        position => renderInfo(position ? { source_type: 'material_file', material_id: Number(position.expected_item_id), title: position.name } : null, true),
        () => renderInfo(selectedPart));
    }
    toolbar.append(title, normal, exploded);
    if (original) toolbar.append(original);
    if (editButton) toolbar.append(editButton);
    toolbar.append(openFull);
    panel.append(toolbar);
    if (editHint) panel.append(editHint);
    const body = element('div', 'eam-visual-body');
    body.append(stage, inspector);
    panel.append(body);
    queueMicrotask(() => {
      if (!panel.isConnected) return;
      const showExploded = requestedExplodedAsset === Number(asset.id);
      if (showExploded) requestedExplodedAsset = null;
      choose(showExploded ? 'exploded' : 'normal');
    });
    return panel;
  }
  function partsList(target, asset, data) {
    const section = element('section', 'eam-visual-section');
    section.append(element('h4', '', 'Máquinas, módulos e peças deste equipamento'));
    const children = data.rollup?.descendants || assetChildren(asset.id);
    const modules = Array.isArray(data.twin.modules) ? data.twin.modules : [];
    const positions = Array.isArray(data.twin.positions) ? data.twin.positions : [];
    const spares = data.rollup?.components || data.spares;
    const list = element('div', 'eam-visual-list');
    children.forEach(child => list.append(listRow(child.asset_code, child.name, `Máquina filha · ${child.status || '—'}`, () => openEamAssetWorkspace(child))));
    modules.forEach(module => list.append(listRow(module.code, module.name, `Módulo · ${positions.filter(position => Number(position.module_id) === Number(module.id)).length} posição(ões)`, () => showModule(target, asset, data, module))));
    positions.filter(position => !position.module_id).forEach(position => list.append(listRow(position.position_number, position.name, `Posição técnica · ${position.quantity_required} unidade(s)`, () => positionAction(target, asset, position))));
    (data.rollup?.unlinked_positions || []).filter(position => Number(position.asset_id) !== Number(asset.id)).forEach(position => list.append(listRow(position.position_number, position.name, `${position.asset_code} · ${position.quantity} unidade(s)`, () => {
      const owner = (window.eamAssetsForWorkspace || []).find(item => Number(item.id) === Number(position.asset_id));
      if (owner) openEamAssetWorkspace(owner);
    })));
    if (!list.children.length) list.append(element('p', 'eam-visual-empty', 'Nenhuma máquina filha ou posição técnica cadastrada.'));
    section.append(list);
    section.append(element('h4', '', 'Componentes e peças de reposição'));
    if (!spares.length) { section.append(element('p', 'eam-visual-empty', 'Nenhuma peça vinculada. Cadastre uma posição técnica ou vincule uma peça na aba Estrutura.')); return section; }
    const wrapper = element('div', 'eam-parts-table-wrap');
    const table = element('table', 'eam-parts-table');
    const head = element('thead'), headRow = element('tr');
    ['Nº', 'Equipamento', 'Código', 'Descrição', 'Marca', 'Setor', 'Local', 'BOM / limites', 'Saldo', 'Custo', 'Estoque', 'Ações'].forEach(label => headRow.append(element('th', '', label)));
    head.append(headRow);
    const body = element('tbody');
    const pageSize = 10, pages = Math.ceil(spares.length / pageSize);
    const controls = element('div', 'eam-parts-pagination');
    let page = 0;
    function draw(showAll = false) {
      body.replaceChildren();
      const offset = showAll ? 0 : page * pageSize;
      (showAll ? spares : spares.slice(offset, (page + 1) * pageSize)).forEach((spare, index) => {
        const row = element('tr');
        const balance = Number(spare.stock_quantity) || 0, minimum = Number(spare.min_qty) || 0;
        const stock = balance <= 0 ? 'Sem estoque' : balance < minimum ? 'Abaixo do mínimo' : 'Disponível';
        row.append(element('td', '', offset + index + 1));
        const owner = (window.eamAssetsForWorkspace || []).find(item => Number(item.id) === Number(spare.asset_id)) || (validId(spare.asset_id) ? { id: Number(spare.asset_id), asset_code: spare.asset_code, name: spare.asset_name } : asset);
        const bomLimits = `${spare.quantity} un. · mín. ${spare.minimum_quantity ?? '—'} · máx. ${spare.maximum_quantity ?? '—'}`;
        [spare.asset_code || owner.asset_code, spare.code, spare.description, spare.brand, spare.sector, spare.functional_location_code || spare.location, bomLimits, balance, money(spare.unit_price, spare.currency)].forEach(value => row.append(element('td', '', value ?? '—')));
        const status = element('td'); status.append(element('span', `eam-stock-badge ${balance <= 0 ? 'empty' : balance < minimum ? 'low' : 'ok'}`, stock)); row.append(status);
        const actions = element('td', 'eam-parts-actions');
        actions.append(button('Ficha', () => renderPart(target, owner, Number(spare.material_id))));
        actions.append(button('Requisitar', async () => { await renderPart(target, owner, Number(spare.material_id)); target.querySelector('.eam-part-requisition input')?.focus(); }));
        actions.append(button('QR', () => showQRCode(spare.code, spare.description)));
        actions.append(button('Editar', () => openEditMaterial(spare.code)));
        row.append(actions); body.append(row);
      });
      controls.replaceChildren(button('Anterior', () => { page--; draw(); }), element('span', '', `${page + 1} / ${pages}`), button('Próxima', () => { page++; draw(); }));
      controls.firstChild.disabled = page === 0;
      controls.lastChild.disabled = page >= pages - 1;
    }
    draw();
    table.addEventListener('eam:print-all', () => { draw(true); window.addEventListener('afterprint', () => draw(), { once: true }); });
    table.append(head, body); wrapper.append(table); section.append(wrapper);
    if (pages > 1) section.append(controls);
    return section;
  }
  async function renderOverview(target, asset) {
    const serial = ++requestSerial;
    target.replaceChildren(element('p', 'eam-visual-empty', 'Carregando ficha do equipamento…'));
    try {
      const data = await bundle(Number(asset.id));
      if (serial !== requestSerial || !target.isConnected || Number(window.eamActiveAsset?.id) !== Number(asset.id)) return;
      const stats = element('div', 'eam-visual-stats');
      stats.append(
        stat('Equipamento', asset.name || '—', asset.asset_code),
        stat('Máquinas filhas', data.rollup?.descendants?.length ?? assetChildren(asset.id).length, asset.functional_location_name || asset.location || 'Sem localização'),
        stat('Componentes totais', data.rollup?.total_components ?? data.spares.length, `${data.rollup?.descendants?.length ?? assetChildren(asset.id).length} máquina(s) · ${data.rollup?.components?.length ?? data.spares.length} tipo(s) de peça · ${data.twin.modules?.length || 0} módulo(s)`),
        stat('Criticidade', severityLabel[asset.criticality] || asset.criticality || '—', statusLabel[asset.status] || asset.status || '—')
      );
      const catalog = button('Imprimir catálogo / salvar PDF', () => { target.querySelector('.eam-parts-table')?.dispatchEvent(new Event('eam:print-all')); window.print(); });
      catalog.classList.add('eam-catalog-print');
      target.replaceChildren(stats, visualPanel(asset, data, target, false), partsList(target, asset, data), catalog);
      if (data.warnings.length) target.append(element('p', 'eam-visual-warning', data.warnings.join(' · ')));
    } catch (error) { showError(target, error.message || 'Falha ao abrir ativo'); }
  }
  function showModule(target, asset, data, module) {
    ++requestSerial;
    target.replaceChildren();
    const back = button('← Voltar ao equipamento', () => renderOverview(target, asset));
    const header = element('div', 'eam-visual-section');
    header.append(back, element('h3', '', `${module.code} · ${module.name}`));
    const visuals = (data.twin.visuals || []).filter(visual => Number(visual.module_id) === Number(module.id));
    const stage = element('div', 'eam-visual-stage');
    const visual = visualChoice(visuals, 'normal', module.id) || visuals[0];
    visualStage(stage, Number(asset.id), visual, data.twin.positions || [], false, position => positionAction(target, asset, position));
    header.append(stage);
    const list = element('div', 'eam-visual-list');
    (data.twin.modules || []).filter(child => Number(child.parent_module_id) === Number(module.id)).forEach(child => list.append(listRow(child.code, child.name, 'Submódulo', () => showModule(target, asset, data, child))));
    (data.twin.positions || []).filter(position => Number(position.module_id) === Number(module.id)).forEach(position => list.append(listRow(position.position_number, position.name, `Qtd. ${position.quantity_required}`, () => positionAction(target, asset, position))));
    if (!list.children.length) list.append(element('p', 'eam-visual-empty', 'Nenhuma posição técnica neste módulo.'));
    target.append(header, list);
    const documents = data.documents.filter(documentItem => documentItem.owner_type === 'module' && Number(documentItem.owner_id) === Number(module.id));
    if (documents.length) {
      const documentList = element('div', 'eam-visual-list');
      documents.forEach(documentItem => documentList.append(listRow(documentItem.document_number, documentItem.title, documentItem.document_type, () => previewDocument(target, documentItem))));
      target.append(element('h4', '', 'Desenhos e manuais do módulo'), documentList);
    }
  }
  function moduleTree(target, asset, data) {
    const modules = Array.isArray(data.twin.modules) ? data.twin.modules : [];
    const byId = new Set(modules.map(module => Number(module.id)));
    const visited = new Set();
    const tree = element('div', 'eam-module-tree');
    function appendModule(module, parent) {
      const id = Number(module.id);
      if (visited.has(id)) return;
      visited.add(id);
      const branch = element('div', 'eam-module-branch');
      branch.append(listRow(module.code, module.name, 'Módulo', () => showModule(target, asset, data, module)));
      (data.twin.positions || []).filter(position => Number(position.module_id) === id).forEach(position => branch.append(listRow(position.position_number, position.name, 'Posição técnica', () => positionAction(target, asset, position))));
      modules.filter(child => Number(child.parent_module_id) === id).forEach(child => appendModule(child, branch));
      parent.append(branch);
    }
    modules.filter(module => !module.parent_module_id || !byId.has(Number(module.parent_module_id))).forEach(module => appendModule(module, tree));
    modules.filter(module => !visited.has(Number(module.id))).forEach(module => appendModule(module, tree));
    return tree;
  }
  function assemblyEditor(asset, data) {
    const group = element('details', 'eam-assembly-disclosure');
    group.append(element('summary', '', 'Montar partes 3D'));
    const form = element('form', 'eam-assembly-transform-form');
    const sources = assemblySources(data);
    const missing = sources.filter(source => source.source_type !== 'equipment_visual' && !data.assembly.some(part => assemblyKey(part) === assemblyKey(source)));
    const visualSelect = element('select', 'eo-input');
    const moduleSelect = element('select', 'eo-input');
    const positionSelect = element('select', 'eo-input');
    visualSelect.setAttribute('aria-label', 'Modelo 3D da parte');
    moduleSelect.setAttribute('aria-label', 'Módulo da parte');
    positionSelect.setAttribute('aria-label', 'Posição técnica da peça');
    selectOptions(visualSelect, sources, 'Modelo 3D da parte', assemblyKey, row => `${row.source_type === 'child_visual' ? 'Máquina filha' : row.source_type === 'material_file' ? 'Spare part' : 'Ativo'} · ${row.title || row.filename}`);
    selectOptions(moduleSelect, data.twin.modules || [], 'Sem módulo', row => row.id, row => `${row.code} · ${row.name}`);
    selectOptions(positionSelect, data.twin.positions || [], 'Sem peça vinculada', row => row.id, row => `${row.position_number} · ${row.name}`);
    visualSelect.required = true;
    const fields = [['tx', 'X'], ['ty', 'Y'], ['tz', 'Z'], ['rx', 'Giro X °'], ['ry', 'Giro Y °'], ['rz', 'Giro Z °'], ['scale_factor', 'Escala'], ['explode_dx', 'Separar X'], ['explode_dy', 'Separar Y'], ['explode_dz', 'Separar Z']];
    const inputs = new Map();
    fields.forEach(([key, label]) => {
      const input = element('input', 'eo-input');
      input.type = 'number'; input.step = '.0001'; input.required = true; input.value = key === 'scale_factor' ? '1' : '0'; input.setAttribute('aria-label', label); input.placeholder = label;
      input.dataset.assemblyField = key;
      inputs.set(key, input);
    });
    const anchorInputs = ['x', 'y', 'z'].map(axis => {
      const input = element('input', 'eo-input'); input.type = 'number'; input.step = '.0001'; input.placeholder = `Âncora ${axis.toUpperCase()}`; input.setAttribute('aria-label', `Âncora ${axis.toUpperCase()}`); input.dataset.assemblyAnchor = axis; return input;
    });
    const anchorFeedback = element('p', 'eam-assembly-anchor-feedback', 'Clique na superfície de uma parte 3D para marcar o ponto de uso da peça.');
    const remove = button('Remover da montagem', async () => {
      const part = data.assembly.find(item => assemblyKey(item) === visualSelect.value);
      if (!part) return;
      const [sourceType, sourceId] = visualSelect.value.split(':');
      remove.disabled = true;
      const endpoint = sourceType === 'equipment_visual'
        ? `/eam/assets/${Number(asset.id)}/assembly-parts/${Number(sourceId)}`
        : `/eam/assets/${Number(asset.id)}/assembly-sources/${encodeURIComponent(sourceType)}/${Number(sourceId)}`;
      const result = await API.delete(endpoint);
      if (result.success) { showToast('Parte removida da montagem', 'success'); refresh(asset.id); }
      else { remove.disabled = false; showToast(result.error || 'Não foi possível remover a parte', 'error'); }
    });
    remove.disabled = true;
    visualSelect.addEventListener('change', () => {
      const part = data.assembly.find(item => assemblyKey(item) === visualSelect.value);
      const source = sources.find(item => assemblyKey(item) === visualSelect.value);
      const suggestedPosition = !part && source?.material_id ? (data.twin.positions || []).find(item => Number(item.expected_item_id) === Number(source.material_id)) : null;
      remove.disabled = !part;
      moduleSelect.value = part?.module_id ? String(part.module_id) : suggestedPosition?.module_id ? String(suggestedPosition.module_id) : '';
      positionSelect.value = part?.component_position_id ? String(part.component_position_id) : suggestedPosition ? String(suggestedPosition.id) : '';
      fields.forEach(([key]) => { inputs.get(key).value = String(part?.[key] ?? (key === 'scale_factor' ? 1 : key === 'explode_dx' ? sources.findIndex(item => assemblyKey(item) === visualSelect.value) * 3 : 0)); });
      anchorInputs.forEach((input, index) => { input.value = part?.[`anchor_${['x', 'y', 'z'][index]}`] ?? ''; });
    });
    const save = element('button', 'btn btn-primary btn-sm', 'Salvar posição da parte'); save.type = 'submit';
    if (missing.length) {
      const create = button(`Criar vista com ${missing.length} modelo(s) 3D`, async () => {
        create.disabled = true;
        if (!await createAssembly(asset, data, missing)) create.disabled = false;
      }, 'btn btn-primary btn-sm');
      group.append(create);
    }
    form.append(visualSelect, moduleSelect, positionSelect);
    fields.forEach(([key, label]) => {
      const field = element('label', 'eam-assembly-field');
      field.append(element('span', '', label), inputs.get(key));
      form.append(field);
    });
    form.append(anchorFeedback, ...anchorInputs);
    form.append(save, remove);
    form.addEventListener('submit', async event => {
      event.preventDefault(); save.disabled = true;
      const [sourceType, sourceId] = visualSelect.value.split(':');
      const payload = { source_type: sourceType, source_id: Number(sourceId), module_id: Number(moduleSelect.value) || null, component_position_id: Number(positionSelect.value) || null };
      if (sourceType === 'equipment_visual') payload.visual_id = Number(sourceId);
      fields.forEach(([key]) => { payload[key] = Number(inputs.get(key).value); });
      anchorInputs.forEach((input, index) => { payload[`anchor_${['x', 'y', 'z'][index]}`] = input.value === '' ? null : Number(input.value); });
      const result = await API.post(`/eam/assets/${Number(asset.id)}/${sourceType === 'equipment_visual' ? 'assembly-parts' : 'assembly-sources'}`, payload);
      save.disabled = false;
      if (result.success) {
        if (requestedEditorAsset === Number(asset.id)) requestedExplodedAsset = Number(asset.id);
        showToast('Montagem 3D atualizada', 'success');
        refresh(asset.id);
      }
      else showToast(result.error || 'Não foi possível salvar montagem', 'error');
    });
    group.append(element('p', 'eam-form-hint', sources.length
      ? 'Escolha modelos 3D do ativo, de máquinas filhas ou das spare parts vinculadas; defina posição e deslocamento da explosão.'
      : data.candidateError
        ? `Não foi possível carregar os modelos 3D: ${data.candidateError}`
        : 'Ainda não há modelos 3D disponíveis. Anexe um modelo ao ativo filho ou à spare part vinculada para montar a vista explodida.'));
    group.append(form);
    return group;
  }
  async function renderAssembly(target, asset) {
    const serial = ++requestSerial;
    target.replaceChildren(element('p', 'eam-visual-empty', 'Carregando montagem…'));
    try {
      const data = await bundle(Number(asset.id));
      if (serial !== requestSerial || !target.isConnected || Number(window.eamActiveAsset?.id) !== Number(asset.id)) return;
      syncEditorOptions(data);
      const layout = element('div', 'eam-assembly-layout');
      const tree = element('aside', 'eam-assembly-column');
      tree.append(element('h4', '', 'Árvore do equipamento'));
      tree.append(listRow(asset.asset_code, asset.name, 'Equipamento principal', () => renderOverview(target, asset)));
      assetChildren(asset.id).forEach(child => tree.append(listRow(child.asset_code, child.name, 'Máquina filha', () => openEamAssetWorkspace(child))));
      if (data.assembly.length) {
        tree.append(element('h4', 'eam-assembly-parts-title', 'Peças da montagem 3D'));
        data.assembly.forEach((part, index) => {
          const row = element('div', 'eam-visual-list-row');
          const details = element('div');
          details.append(element('strong', '', `${index + 1}. ${part.title || part.filename || 'Peça 3D'}`), element('small', '', part.source_type === 'material_file' ? 'Spare part' : part.source_type === 'child_visual' ? 'Máquina filha' : 'Modelo do ativo'));
          row.append(details, button('Selecionar', () => {
            requestedEditorAsset = Number(asset.id);
            requestedExplodedAsset = Number(asset.id);
            requestedEditorPart = { assetId: Number(asset.id), key: assemblyKey(part) };
            renderAssembly(target, asset);
          }));
          tree.append(row);
        });
      }
      tree.append(moduleTree(target, asset, data));
      (data.twin.positions || []).filter(position => !position.module_id).forEach(position => tree.append(listRow(position.position_number, position.name, 'Posição técnica sem módulo', () => positionAction(target, asset, position))));
      const center = element('div', 'eam-assembly-column');
      center.append(visualPanel(asset, data, target, true));
      const visualList = element('div', 'eam-visual-list');
      (data.twin.visuals || []).forEach(visual => visualList.append(listRow(visual.type, visual.title, visual.module_id ? `Módulo #${visual.module_id}` : 'Equipamento completo', () => openEamVisual(Number(asset.id), visual))));
      center.append(element('h4', '', 'Vistas cadastradas'), visualList);
      const actions = element('aside', 'eam-assembly-column');
      actions.append(element('h4', '', 'Configuração do ativo'));
      for (const [name, label] of [['createEamModule', 'Adicionar módulo'], ['createEamComponentPosition', 'Indexar posição e peça'], ['addEamAssetSpare', 'Vincular spare part'], ['createEamVisual', 'Anexar imagem ou 3D']]) {
        const group = element('details', 'eam-assembly-disclosure');
        group.append(element('summary', '', label));
        eamContextForm(name, group);
        actions.append(group);
      }
      actions.insertBefore(assemblyEditor(asset, data), actions.children[1] || null);
      const hotspotEditor = element('details', 'eam-assembly-disclosure');
      hotspotEditor.append(element('summary', '', 'Marcar peça na imagem'));
      moveEamContextNode(document.getElementById('eamHotspotForm'), hotspotEditor);
      actions.append(hotspotEditor);
      actions.append(element('p', 'eam-form-hint', 'Selecione uma imagem da lista, clique no ponto de uso da peça, escolha a posição técnica e salve. Para um módulo, associe a vista ao módulo no formulário acima.'));
      layout.append(tree, center, actions);
      target.replaceChildren(layout);
      if (requestedCreatorAsset === Number(asset.id)) {
        requestedCreatorAsset = null;
        const assemblyGroup = [...actions.querySelectorAll('.eam-assembly-disclosure')].find(item => item.querySelector('summary')?.textContent === 'Montar partes 3D');
        if (assemblyGroup) { assemblyGroup.open = true; assemblyGroup.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      }
      if (requestedEditorAsset === Number(asset.id)) {
        const editor = actions.querySelector('.eam-assembly-transform-form')?.closest('details');
        if (editor) editor.open = true;
      }
    } catch (error) { showError(target, error.message || 'Falha ao abrir montagem'); }
  }
  async function renderComponents(target, asset) {
    const serial = ++requestSerial;
    target.replaceChildren(element('p', 'eam-visual-empty', 'Carregando peças…'));
    try {
      const data = await bundle(Number(asset.id));
      if (serial !== requestSerial || !target.isConnected || Number(window.eamActiveAsset?.id) !== Number(asset.id)) return;
      const list = partsList(target, asset, data);
      const forms = element('div', 'eam-visual-form-grid');
      eamContextForm('submitEamComponentInstance', forms);
      target.replaceChildren(list, element('h4', '', 'Configuração instalada'), forms);
    } catch (error) { showError(target, error.message || 'Falha ao abrir peças'); }
  }
  async function renderDocuments(target, asset) {
    const serial = ++requestSerial;
    const list = element('div', 'eam-visual-list');
    target.append(list);
    const [result, twinResult] = await Promise.all([
      API.get(`/eam/assets/${Number(asset.id)}/documents`),
      API.get(`/eam/assets/${Number(asset.id)}/digital-twin`)
    ]);
    if (serial !== requestSerial || !list.isConnected) return;
    if (!result.success) { showError(list, result.error || 'Documentos indisponíveis'); return; }
    if (twinResult.success) syncEditorOptions({ twin: twinResult.data || {} });
    const modules = Array.isArray(twinResult.data?.modules) ? twinResult.data.modules : [];
    const documents = Array.isArray(result.data) ? result.data : [];
    documents.forEach(documentItem => {
      const owner = documentItem.owner_type === 'module' ? modules.find(module => Number(module.id) === Number(documentItem.owner_id))?.name || `Módulo #${documentItem.owner_id}` : 'Equipamento';
      const row = listRow(documentItem.document_number, documentItem.title, `${owner} · ${documentItem.document_type} · revisão ${documentItem.revision_code || '—'}`, () => previewDocument(target, documentItem));
      list.append(row);
    });
    if (!documents.length) list.append(element('p', 'eam-visual-empty', 'Nenhum documento técnico cadastrado.'));
  }
  async function renderHistory(target, asset) {
    const serial = ++requestSerial;
    const section = element('section', 'eam-visual-section', 'Carregando histórico…');
    target.append(section);
    const [twinResult, historyResult] = await Promise.all([
      API.get(`/eam/assets/${Number(asset.id)}/digital-twin`),
      API.get(`/eam/assets/${Number(asset.id)}/installation-history`)
    ]);
    if (serial !== requestSerial || !section.isConnected || Number(window.eamActiveAsset?.id) !== Number(asset.id)) return;
    section.replaceChildren(element('h4', '', 'Projetado × instalado'));
    if (twinResult.success) {
      const positions = Array.isArray(twinResult.data?.positions) ? twinResult.data.positions : [];
      const instances = Array.isArray(twinResult.data?.instances) ? twinResult.data.instances : [];
      if (positions.length) {
        const wrapper = element('div', 'eam-parts-table-wrap'), table = element('table', 'eam-parts-table'), head = element('thead'), heading = element('tr'), body = element('tbody');
        ['Posição', 'Peça projetada', 'Peça instalada', 'Estado'].forEach(label => heading.append(element('th', '', label)));
        head.append(heading);
        positions.forEach(position => {
          const installed = instances.filter(item => Number(item.component_position_id) === Number(position.id) && item.status === 'installed');
          const expected = Number(position.expected_item_id), matches = installed.length > 0 && installed.every(item => Number(item.inventory_item_id) === expected);
          const state = !installed.length ? 'Não instalada' : matches && installed.length >= Number(position.quantity_required || 1) ? 'Conforme' : 'Divergente';
          const row = element('tr');
          [position.position_number || position.name, position.expected_item_code || 'Não definida', installed.map(item => item.inventory_item_code || `#${item.inventory_item_id || item.id}`).join(', ') || '—', state].forEach(value => row.append(element('td', '', value)));
          body.append(row);
        });
        table.append(head, body); wrapper.append(table); section.append(wrapper);
      } else section.append(element('p', 'eam-visual-empty', 'Nenhuma posição técnica definida.'));
    } else section.append(element('p', 'eam-visual-warning', twinResult.error || 'Configuração indisponível'));
    section.append(element('h4', '', 'Revisões de engenharia'));
    if (!twinResult.success) section.append(element('p', 'eam-visual-warning', twinResult.error || 'Revisões indisponíveis'));
    else {
      const revisions = twinResult.data?.revisions || [];
      revisions.forEach(revision => section.append(listRow(revision.revision_code, revision.change_order || 'Baseline do equipamento', `${revision.status || 'draft'} · ${revision.effective_from || revision.created_at || 'Data não registrada'}`, () => showToast(revision.notes || 'Sem notas adicionais', 'info'))));
      if (!revisions.length) section.append(element('p', 'eam-visual-empty', 'Nenhuma revisão cadastrada.'));
    }
    section.append(element('h4', '', 'Trocas e instalações de componentes'));
    if (!historyResult.success) section.append(element('p', 'eam-visual-warning', historyResult.error || 'Histórico indisponível'));
    else {
      const history = Array.isArray(historyResult.data) ? historyResult.data : [];
      history.forEach(record => section.append(stat(`${record.position_number || '—'} · ${record.position_name || 'Peça'}`, record.reason || 'Substituição', `${record.created_at || 'Data não registrada'} · instância ${record.old_instance_id || '—'} → ${record.new_instance_id || '—'}${record.work_order_id ? ` · O.S. #${record.work_order_id}` : ''}`)));
      if (!history.length) section.append(element('p', 'eam-visual-empty', 'Nenhuma substituição registrada.'));
    }
  }
  async function previewDocument(target, documentItem) {
    if (!validId(documentItem.id) || !validId(documentItem.revision_id)) return showToast('Documento sem revisão disponível', 'error');
    const ext = extension(documentItem.filename);
    const url = `${API.BASE_URL}/eam/documents/${Number(documentItem.id)}/revisions/${Number(documentItem.revision_id)}/data`;
    if (ext === 'dxf') return previewDxf(target, url, documentItem.filename);
    if (!['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      try { downloadEamBlob(await fetchEamAttachment(url), documentItem.filename); showToast('Arquivo técnico baixado; visualização nativa indisponível para este formato', 'info'); }
      catch (error) { showToast(error.message || 'Arquivo indisponível', 'error'); }
      return;
    }
    try {
      const source = await fetchEamAttachment(url);
      if (!target.isConnected) return;
      const typed = new Blob([source], { type: ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}` });
      const objectUrl = URL.createObjectURL(typed);
      activeDocumentUrls.add(objectUrl);
      const preview = element('section', 'eam-document-preview');
      const close = button('Fechar visualização', () => { URL.revokeObjectURL(objectUrl); activeDocumentUrls.delete(objectUrl); preview.remove(); });
      const viewer = ext === 'pdf' ? element('iframe') : element('img');
      viewer.src = objectUrl;
      viewer.title = documentItem.title || 'Documento técnico';
      if (ext === 'pdf') viewer.setAttribute('sandbox', 'allow-scripts');
      preview.append(close, viewer);
      target.prepend(preview);
      preview.scrollIntoView({ block: 'nearest' });
    } catch (error) { showToast(error.message || 'Não foi possível abrir documento', 'error'); }
  }
  async function previewDxf(target, url, filename) {
    try {
      const source = await fetchEamAttachment(url);
      if (!target.isConnected) return;
      if (source.size > EamDxfViewer.MAX_BYTES) throw new Error('DXF excede o limite de pré-visualização');
      const parsed = EamDxfViewer.parseDxf(await source.text());
      if (activeDxfCleanup) activeDxfCleanup();
      const preview = element('section', 'eam-document-preview');
      const content = element('div', 'eam-dxf-viewer');
      preview.append(button('Fechar visualização', () => { activeDxfCleanup?.(); activeDxfCleanup = null; preview.remove(); }), button('Baixar DXF', () => downloadEamBlob(source, filename)), content);
      target.prepend(preview);
      activeDxfCleanup = EamDxfViewer.render(content, parsed);
      preview.scrollIntoView({ block: 'nearest' });
    } catch (error) { showToast(error.message || 'Não foi possível abrir DXF', 'error'); }
  }
  async function renderPart(target, asset, materialId) {
    const serial = ++requestSerial;
    disposePreview();
    if (!validId(materialId)) return;
    target.replaceChildren(element('p', 'eam-visual-empty', 'Carregando componente…'));
    const materialResult = await API.get(`/materials/${materialId}`);
    if (!materialResult.success || !materialResult.data) return showError(target, materialResult.error || 'Componente não encontrado');
    if (serial !== requestSerial || !target.isConnected || Number(window.eamActiveAsset?.id) !== Number(asset.id)) return;
    const material = materialResult.data;
    const [sourcesResult, filesResult, usageResult, reliabilityResult, pricesResult] = await Promise.all([
      API.get(`/procurement/sources?material_id=${materialId}`),
      API.get(`/materials/${encodeURIComponent(material.code)}/files`),
      API.get(`/eam/assets/${Number(asset.id)}/spares/${materialId}/usage`),
      API.get(`/eam/assets/${Number(asset.id)}/spares/${materialId}/reliability`),
      API.get(`/procurement/sources/price-history?material_id=${materialId}`)
    ]);
    if (serial !== requestSerial || !target.isConnected || Number(window.eamActiveAsset?.id) !== Number(asset.id)) return;
    const sources = sourcesResult.success && Array.isArray(sourcesResult.data) ? sourcesResult.data : [];
    const files = filesResult.success && Array.isArray(filesResult.data) ? filesResult.data : [];
    const usage = usageResult.success && Array.isArray(usageResult.data) ? usageResult.data : [];
    const reliability = reliabilityResult.success ? reliabilityResult.data : null;
    const header = element('div', 'eam-part-header');
    header.append(button('← Voltar ao equipamento', () => renderOverview(target, asset)), element('h3', '', `${material.code || '—'} · ${material.description || '—'}`));
    header.append(button('Abrir O.S. para esta peça', () => {
      switchEamSection('orders', document.querySelector('#panel-eam [onclick*="orders"]'));
      const assetSelect = document.getElementById('eamOrderAsset'), titleInput = document.getElementById('eamOrderTitle');
      if (assetSelect) assetSelect.value = String(asset.id);
      if (titleInput) { titleInput.value = `Inspecionar ${material.code} · ${material.description || 'peça'} no ativo ${asset.asset_code || asset.name}`.slice(0, 200); titleInput.focus(); }
    }, 'btn btn-primary btn-sm'));
    const layout = element('div', 'eam-part-layout');
    const imagePanel = element('section', 'eam-assembly-column');
    imagePanel.append(element('h4', '', 'Peça e arquivos 3D'));
    const picture = element('div', 'eam-part-picture');
    if (typeof material.image_data === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(material.image_data)) {
      const image = element('img'); image.src = material.image_data; image.alt = material.description || 'Peça'; picture.append(image);
    } else picture.append(element('p', 'eam-visual-empty', 'Imagem não cadastrada.'));
    imagePanel.append(picture);
    files.filter(file => modelExtensions.has(extension(file.filename))).forEach(file => imagePanel.append(button(`Abrir 3D · ${file.filename}`, () => open3DViewer(`${API.BASE_URL}/materials/${encodeURIComponent(material.code)}/files/${Number(file.id)}/data`, extension(file.filename), file.filename))));
    const detail = element('section', 'eam-assembly-column');
    detail.append(element('h4', '', 'Dados técnicos e logísticos'));
    const facts = element('div', 'eam-part-facts');
    [['Fabricante / marca', material.brand], ['País de origem', material.origin_country], ['Modelo', material.model], ['Setor', material.sector], ['Local no armazém', material.location], ['Estoque atual', material.quantity], ['Estoque mínimo', material.min_qty], ['Estoque máximo', material.max_qty], ['Estoque de segurança', material.safety_stock], ['Ponto de reposição', material.reorder_point], ['Curva ABC', material.abc_class], ['Prazo de reposição', material.lead_time_days == null ? null : `${material.lead_time_days} dia(s)`], ['Preço unitário', money(material.unit_price, material.currency)], ['Intercambiável', material.interchangeable ? 'Sim' : 'Não'], ['Substitutos', material.interchange_with]].forEach(([label, value]) => facts.append(stat(label, value ?? '—')));
    detail.append(facts, element('h4', '', 'Fornecedores cadastrados'));
    if (sources.length) sources.forEach(source => detail.append(stat(source.supplier_name || 'Fornecedor', money(source.unit_price, source.currency), `Contato: ${source.contact_name || source.contact_email || '—'} · Prazo: ${source.lead_time_days ?? '—'} dia(s) · SKU ${source.supplier_sku || '—'}`)));
    else detail.append(element('p', 'eam-visual-empty', 'Nenhuma fonte de suprimento cadastrada.'));
    const prices = pricesResult.success && Array.isArray(pricesResult.data) ? pricesResult.data : [];
    if (prices.length) {
      detail.append(element('h4', '', 'Histórico de preços registrados'));
      const priceList = element('div', 'eam-price-history');
      prices.forEach(price => priceList.append(stat(price.supplier_name || 'Fornecedor', money(price.unit_price, price.currency), price.created_at ? new Date(price.created_at).toLocaleDateString('pt-BR') : 'Data indisponível')));
      detail.append(priceList);
    }
    detail.append(element('h4', '', 'Consumo na organização · últimos 12 meses'));
    const consumption = element('div', 'eam-consumption-chart');
    const max = Math.max(1, ...usage.map(point => Number(point.consumed) || 0));
    usage.forEach(point => {
      const column = element('div', 'eam-consumption-column');
      const bar = element('div', 'eam-consumption-bar');
      bar.style.height = `${Math.max(2, (Number(point.consumed) || 0) / max * 100)}%`;
      bar.title = `${point.month}: ${point.consumed} unidade(s)`;
      column.append(element('strong', '', point.consumed), bar, element('small', '', point.month));
      consumption.append(column);
    });
    if (usage.length) detail.append(consumption);
    else detail.append(element('p', 'eam-visual-empty', usageResult.success ? 'Sem saídas registradas nos últimos 12 meses.' : 'Histórico de consumo indisponível para este vínculo.'));
    if (usageResult.success) {
      const monthlyAverage = usage.reduce((sum, point) => sum + (Number(point.consumed) || 0), 0) / 12;
      const coverage = monthlyAverage > 0 ? Math.max(0, Number(material.quantity) || 0) / monthlyAverage : null;
      detail.append(stat('Cobertura estimada pelo consumo registrado', coverage == null ? 'Sem base de consumo' : `${coverage.toFixed(1)} mês(es)`, 'Hipótese de coleta completa e consumo linear nas saídas da organização; não é consumo atribuído a este equipamento.'));
    }
    detail.append(element('h4', '', 'Paradas atribuídas à peça · últimos 365 dias'));
    if (reliability) {
      const indicators = element('div', 'eam-part-facts');
      indicators.append(stat('Ordens corretivas', reliability.corrective_orders), stat('MTBF estimado', reliability.mtbf_hours == null ? 'Sem dados' : `${Number(reliability.mtbf_hours).toFixed(1)} h`), stat('MTTR registrado', reliability.mttr_hours == null ? 'Sem dados' : `${Number(reliability.mttr_hours).toFixed(1)} h`));
      detail.append(indicators);
      for (const warning of reliability.warnings || []) detail.append(element('p', 'eam-visual-empty', warning));
    } else detail.append(element('p', 'eam-visual-empty', 'Indicadores de confiabilidade indisponíveis.'));
    const requisition = element('form', 'eam-part-requisition');
    const quantity = element('input', 'eo-input'); quantity.type = 'number'; quantity.min = '0.001'; quantity.max = '100000'; quantity.step = '0.001'; quantity.required = true; quantity.placeholder = 'Quantidade para reposição'; quantity.setAttribute('aria-label', 'Quantidade para reposição');
    const reason = element('input', 'eo-input'); reason.required = true; reason.maxLength = 200; reason.placeholder = 'Motivo da requisição'; reason.setAttribute('aria-label', 'Motivo da requisição');
    const submit = element('button', 'btn btn-primary btn-sm', 'Solicitar peça'); submit.type = 'submit';
    requisition.append(quantity, reason, submit);
    requisition.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      const result = await API.post(`/eam/assets/${Number(asset.id)}/spares/${materialId}/requisitions`, { quantity: Number(quantity.value), reason: reason.value });
      submit.disabled = false;
      if (result.success) { requisition.reset(); showToast('Requisição registrada para aprovação', 'success'); }
      else showToast(result.error || 'Não foi possível registrar a requisição', 'error');
    });
    detail.append(element('h4', '', 'Reposição da peça'), requisition);
    detail.append(element('h4', '', 'Manuais, modelos e anexos'));
    if (typeof material.manual_data === 'string' && /^(?:data:application\/pdf;base64,)?[A-Za-z0-9+/=]+$/.test(material.manual_data)) {
      detail.append(button(material.manual_filename || 'Abrir manual legado em PDF', () => {
        try {
          const encoded = material.manual_data.replace(/^data:application\/pdf;base64,/, '');
          if (encoded.length > 14_000_000) throw new Error('Manual excede o limite de pré-visualização');
          const binary = atob(encoded), bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
          const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
          showPdfPreview(target, objectUrl, material.manual_filename || 'Manual');
        } catch (error) { showToast(error.message || 'Manual inválido', 'error'); }
      }));
    }
    files.forEach(file => detail.append(listRow(file.category, file.filename, file.description || '', async () => {
      const fileUrl = `${API.BASE_URL}/materials/${encodeURIComponent(material.code)}/files/${Number(file.id)}/data`;
      if (extension(file.filename) === 'pdf') return previewMaterialPdf(target, fileUrl, file.filename);
      if (extension(file.filename) === 'dxf') return previewDxf(target, fileUrl, file.filename);
      if (modelExtensions.has(extension(file.filename))) return open3DViewer(fileUrl, extension(file.filename), file.filename);
      try { downloadEamBlob(await fetchEamAttachment(fileUrl), file.filename); } catch (error) { showToast(error.message, 'error'); }
    })));
    if (!files.length && !material.manual_data) detail.append(element('p', 'eam-visual-empty', 'Nenhum arquivo anexado à peça.'));
    if (!sourcesResult.success || !filesResult.success) detail.append(element('p', 'eam-visual-warning', 'Parte dos dados complementares não pôde ser carregada.'));
    layout.append(imagePanel, detail);
    target.replaceChildren(header, layout);
  }
  async function previewMaterialPdf(target, url, filename) {
    try {
      const blob = await fetchEamAttachment(url), objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      showPdfPreview(target, objectUrl, filename);
    } catch (error) { showToast(error.message || 'Falha ao abrir PDF', 'error'); }
  }
  function showPdfPreview(target, objectUrl, filename) {
    activeDocumentUrls.add(objectUrl);
    const preview = element('section', 'eam-document-preview');
    const iframe = element('iframe'); iframe.src = objectUrl; iframe.title = filename; iframe.setAttribute('sandbox', 'allow-scripts');
    preview.append(button('Fechar PDF', () => { URL.revokeObjectURL(objectUrl); activeDocumentUrls.delete(objectUrl); preview.remove(); }), iframe);
    target.prepend(preview);
  }
  function refresh(assetId) {
    if (Number(window.eamActiveAsset?.id) !== Number(assetId)) return;
    const activeTab = document.querySelector('#eamAssetWorkspace .eam-workspace-tab.active');
    const body = document.querySelector('#eamAssetWorkspace .eam-workspace-body');
    if (activeTab && body) renderEamAssetWorkspaceTab(body, activeTab.textContent, window.eamActiveAsset);
  }
  function invalidate() { ++requestSerial; disposePreview(); }
  window.EamVisualWorkspace = { renderOverview, renderAssembly, renderComponents, renderDocuments, renderHistory, renderPart, refresh, invalidate };
})();
