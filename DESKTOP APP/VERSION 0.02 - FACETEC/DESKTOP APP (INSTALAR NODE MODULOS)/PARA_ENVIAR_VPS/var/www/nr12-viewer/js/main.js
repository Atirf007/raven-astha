/**
 * PLANTA FABRIL 3D — NR-12 / NR-06 AUDIT VIEWER
 * Three.js + OBJLoader / MTLLoader via CDN
 * KazinhoSystems / ArrudaCorp
 *
 * Suporte a arquivos OBJ grandes (1+ GB):
 * - Carregamento via fetch com barra de progresso real
 * - Parser chunked com setTimeout para não travar a UI
 * - Auto-load de assets/factory.obj se existir no servidor
 */

/* ===================================================
   1. CHECKLIST DATA
   =================================================== */
const CHECKLIST_NR12 = [
  {
    id: 'cat-arranjo',
    icon: '🏭',
    title: 'Arranjo Físico e Instalações',
    subtitle: 'NR-12.3',
    items: [
      { id: 'nr12-001', text: 'Áreas de circulação demarcadas e desobstruídas', tag: 'obrigatorio' },
      { id: 'nr12-002', text: 'Espaço mínimo de 0,60m entre máquinas garantido', tag: 'obrigatorio' },
      { id: 'nr12-003', text: 'Corredores principais com largura ≥ 1,20m', tag: 'obrigatorio' },
      { id: 'nr12-004', text: 'Piso antiderrapante, nivelado e sem irregularidades', tag: 'obrigatorio' },
      { id: 'nr12-005', text: 'Iluminação adequada nas zonas de operação e manutenção', tag: 'importante' },
      { id: 'nr12-006', text: 'Ventilação suficiente para operação segura', tag: 'importante' },
    ]
  },
  {
    id: 'cat-protecoes',
    icon: '🛡️',
    title: 'Proteções e Dispositivos de Segurança',
    subtitle: 'NR-12.4 / NR-12.5',
    items: [
      { id: 'nr12-007', text: 'Proteções físicas (guardas) instaladas em todas as partes móveis', tag: 'obrigatorio' },
      { id: 'nr12-008', text: 'Proteções fixas resistentes e devidamente parafusadas', tag: 'obrigatorio' },
      { id: 'nr12-009', text: 'Proteções móveis com dispositivo de intertravamento', tag: 'obrigatorio' },
      { id: 'nr12-010', text: 'Cortinas de luz / sensores de presença calibrados e funcionando', tag: 'obrigatorio' },
      { id: 'nr12-011', text: 'Dispositivos de segurança testados periodicamente', tag: 'importante' },
      { id: 'nr12-012', text: 'Zonas de perigo claramente identificadas e isoladas', tag: 'importante' },
    ]
  },
  {
    id: 'cat-emergencia',
    icon: '🚨',
    title: 'Parada de Emergência',
    subtitle: 'NR-12.5.4',
    items: [
      { id: 'nr12-013', text: 'Botão de emergência (cogumelo) instalado e acessível', tag: 'obrigatorio' },
      { id: 'nr12-014', text: 'Botão de emergência em local visível do posto de trabalho', tag: 'obrigatorio' },
      { id: 'nr12-015', text: 'Parada de emergência testada — funcionamento confirmado', tag: 'obrigatorio' },
      { id: 'nr12-016', text: 'Sinalização vermelha / amarela no botão e nas áreas de risco', tag: 'importante' },
    ]
  },
  {
    id: 'cat-eletrica',
    icon: '⚡',
    title: 'Instalações Elétricas',
    subtitle: 'NR-12.7 / NR-10',
    items: [
      { id: 'nr12-017', text: 'Quadros elétricos com proteção IP adequada e trancados', tag: 'obrigatorio' },
      { id: 'nr12-018', text: 'Sistema de aterramento verificado e documentado', tag: 'obrigatorio' },
      { id: 'nr12-019', text: 'Cabos e fiações em canaletas, eletrodutos ou conduítes', tag: 'obrigatorio' },
      { id: 'nr12-020', text: 'Proteção contra sobrecarga e curto-circuito instalada', tag: 'obrigatorio' },
      { id: 'nr12-021', text: 'Acesso ao painel elétrico restrito a pessoal autorizado', tag: 'importante' },
    ]
  },
  {
    id: 'cat-loto',
    icon: '🔒',
    title: 'Manutenção, LOTO e Documentação',
    subtitle: 'NR-12.11 / NR-12.12',
    items: [
      { id: 'nr12-022', text: 'Procedimentos de bloqueio de energia perigosa (LOTO) disponíveis', tag: 'obrigatorio' },
      { id: 'nr12-023', text: 'Registros de manutenção preventiva atualizados', tag: 'obrigatorio' },
      { id: 'nr12-024', text: 'Manual da máquina em português disponível no local de operação', tag: 'obrigatorio' },
      { id: 'nr12-025', text: 'Procedimentos de trabalho seguro (PTS/POP) afixados nas máquinas', tag: 'importante' },
      { id: 'nr12-026', text: 'Histórico de reparos e intervenções registrado', tag: 'recomendado' },
    ]
  },
  {
    id: 'cat-sinalizacao',
    icon: '⚠️',
    title: 'Sinalização e Capacitação',
    subtitle: 'NR-12.6 / NR-12.12',
    items: [
      { id: 'nr12-027', text: 'Operadores com treinamento NR-12 documentado e válido', tag: 'obrigatorio' },
      { id: 'nr12-028', text: 'Sinalização de perigo visível e em bom estado de conservação', tag: 'obrigatorio' },
      { id: 'nr12-029', text: 'Placas de instrução e pictogramas fixadas nas máquinas', tag: 'obrigatorio' },
      { id: 'nr12-030', text: 'Comunicação de riscos (GRO/PGR) atualizada', tag: 'importante' },
      { id: 'nr12-031', text: 'Reciclagem periódica de treinamentos de segurança realizada', tag: 'recomendado' },
    ]
  },
];

const CHECKLIST_NR06 = [
  {
    id: 'cat-epi-geral',
    icon: '🦺',
    title: 'Gestão Geral de EPIs',
    subtitle: 'NR-06.3',
    items: [
      { id: 'nr06-001', text: 'EPI fornecido adequado ao risco identificado no LTCAT/PGR', tag: 'obrigatorio' },
      { id: 'nr06-002', text: 'Todos os EPIs possuem CA (Certificado de Aprovação) válido', tag: 'obrigatorio' },
      { id: 'nr06-003', text: 'Ficha de controle de entrega de EPI por colaborador assinada', tag: 'obrigatorio' },
      { id: 'nr06-004', text: 'Treinamento sobre uso correto, guarda e higienização do EPI realizado', tag: 'obrigatorio' },
      { id: 'nr06-005', text: 'Estoque mínimo de EPIs disponível no estabelecimento', tag: 'importante' },
    ]
  },
  {
    id: 'cat-epi-tipo',
    icon: '🥽',
    title: 'EPIs por Categoria de Risco',
    subtitle: 'NR-06 Anexos',
    items: [
      { id: 'nr06-006', text: 'Proteção auditiva (tipo concha ou plug) fornecida nos setores com ruído ≥ 85dB', tag: 'obrigatorio' },
      { id: 'nr06-007', text: 'Óculos de proteção (contra impacto / respingo) disponíveis', tag: 'obrigatorio' },
      { id: 'nr06-008', text: 'Luvas de proteção adequadas ao risco (corte, calor, químico, vibração)', tag: 'obrigatorio' },
      { id: 'nr06-009', text: 'Calçado de segurança (com biqueira de aço ou composite) fornecido', tag: 'obrigatorio' },
      { id: 'nr06-010', text: 'Proteção respiratória (máscara PFF2/N95 ou filtrante) nas áreas de poeira/químicos', tag: 'obrigatorio' },
      { id: 'nr06-011', text: 'Capacete de segurança nas áreas de risco de queda de objetos', tag: 'importante' },
      { id: 'nr06-012', text: 'Avental de couro / raspa para operações com solda ou faísca', tag: 'importante' },
      { id: 'nr06-013', text: 'Cinto de segurança tipo paraquedista para trabalho em altura ≥ 2m', tag: 'importante' },
    ]
  },
  {
    id: 'cat-epi-manutencao',
    icon: '🔧',
    title: 'Conservação e Substituição',
    subtitle: 'NR-06.4',
    items: [
      { id: 'nr06-014', text: 'Higienização e manutenção dos EPIs realizadas conforme fabricante', tag: 'obrigatorio' },
      { id: 'nr06-015', text: 'EPIs com prazo de validade / vida útil vencida descartados e substituídos', tag: 'obrigatorio' },
      { id: 'nr06-016', text: 'Inspeção periódica dos EPIs antes do uso pelos operadores', tag: 'importante' },
      { id: 'nr06-017', text: 'Substituição imediata em caso de dano ou defeito', tag: 'importante' },
    ]
  },
];

/* ===================================================
   2. STATE
   =================================================== */
const state = {
  checkedItems: new Set(),
  activeTab: 'tab-nr12',
  modelLoaded: false,
  modelInfo: { vertices: 0, faces: 0, objects: 0, materials: 0 },
  gridVisible: true,
  wireframeMode: false,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  currentModel: null,
};

/* ===================================================
   3. SCORE UTILS
   =================================================== */
function getAllItems() {
  return [...CHECKLIST_NR12, ...CHECKLIST_NR06].flatMap(c => c.items);
}

function getScore() {
  const all = getAllItems();
  const checked = all.filter(i => state.checkedItems.has(i.id)).length;
  return { checked, total: all.length, pct: Math.round((checked / all.length) * 100) };
}

function getScoreStatus(pct) {
  if (pct < 50) return { label: 'Crítico',  cls: 'critico',  color: '#ef4444' };
  if (pct < 80) return { label: 'Atenção',  cls: 'atencao',  color: '#eab308' };
  return            { label: 'Conforme', cls: 'conforme', color: '#22c55e' };
}

function getSectionScore(cat) {
  const checked = cat.items.filter(i => state.checkedItems.has(i.id)).length;
  return { checked, total: cat.items.length, pct: cat.items.length ? Math.round((checked / cat.items.length) * 100) : 0 };
}

/* ===================================================
   4. RENDER SCORE
   =================================================== */
function updateScoreUI() {
  const { checked, total, pct } = getScore();
  const status = getScoreStatus(pct);

  // Header ring (r=20, circ≈126)
  const hFill = document.getElementById('header-ring-fill');
  if (hFill) {
    hFill.style.strokeDashoffset = 126 - (126 * pct / 100);
    hFill.style.stroke = status.color;
  }
  const hLabel = document.getElementById('header-ring-label');
  if (hLabel) { hLabel.textContent = pct + '%'; hLabel.style.color = status.color; }

  const hPct = document.getElementById('header-score-pct');
  if (hPct) { hPct.textContent = pct + '%'; hPct.className = 'score-pct status-' + status.cls; }

  const hStatus = document.getElementById('header-score-status');
  if (hStatus) hStatus.textContent = status.label;

  // Big ring in summary (r=33, circ≈207)
  const bFill = document.getElementById('big-ring-fill');
  if (bFill) {
    bFill.style.strokeDashoffset = 207 - (207 * pct / 100);
    bFill.style.stroke = status.color;
  }
  const bLabel = document.getElementById('big-ring-label');
  if (bLabel) { bLabel.textContent = pct + '%'; bLabel.style.color = status.color; }

  // Stats
  const el = (id) => document.getElementById(id);
  if (el('stat-checked'))     el('stat-checked').textContent = checked;
  if (el('stat-total'))       el('stat-total').textContent   = total;
  if (el('stat-pending'))     el('stat-pending').textContent = total - checked;

  // Status banner
  const banner = document.getElementById('status-banner');
  if (banner) {
    banner.className = 'status-banner ' + status.cls;
    banner.innerHTML = `<span>${status.cls === 'critico' ? '🔴' : status.cls === 'atencao' ? '🟡' : '🟢'}</span>
                        <span>${status.label}: ${pct}% de conformidade (${checked}/${total} itens)</span>`;
  }

  // Update per-section progress bars
  [...CHECKLIST_NR12, ...CHECKLIST_NR06].forEach(cat => {
    const sc = getSectionScore(cat);
    const fill = document.getElementById('bar-fill-' + cat.id);
    const cnt  = document.getElementById('count-' + cat.id);
    const mini = document.getElementById('mini-fill-' + cat.id);
    if (fill) fill.style.width = sc.pct + '%';
    if (cnt)  cnt.textContent  = sc.checked + '/' + sc.total;
    if (mini) mini.style.width = sc.pct + '%';
  });
}

/* ===================================================
   5. BUILD CHECKLIST HTML
   =================================================== */
function buildChecklist(categories, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  categories.forEach((cat, idx) => {
    const section = document.createElement('div');
    section.className = 'checklist-section';

    const header = document.createElement('div');
    header.className = 'section-header' + (idx === 0 ? ' expanded' : '');
    header.innerHTML = `
      <div class="section-left">
        <div class="section-icon">${cat.icon}</div>
        <div>
          <div class="section-title">${cat.title}</div>
          <div class="section-subtitle">${cat.subtitle}</div>
        </div>
      </div>
      <div class="section-right">
        <div class="section-mini-bar">
          <div class="section-mini-bar-fill" id="mini-fill-${cat.id}" style="width:0%"></div>
        </div>
        <span class="section-count" id="count-${cat.id}">0/${cat.items.length}</span>
        <span class="section-chevron">▼</span>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'section-body' + (idx === 0 ? ' expanded' : '');

    cat.items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'check-item';
      div.dataset.id = item.id;

      const tagClass = {
        obrigatorio: 'tag-obrigatorio',
        importante:  'tag-importante',
        recomendado: 'tag-recomendado',
      }[item.tag] || '';
      const tagLabel = {
        obrigatorio: 'Obrigatório',
        importante:  'Importante',
        recomendado: 'Recomendado',
      }[item.tag] || '';

      div.innerHTML = `
        <div class="checkmark"></div>
        <span class="check-text">${item.text}</span>
        <span class="check-tag ${tagClass}">${tagLabel}</span>
      `;

      div.addEventListener('click', () => toggleItem(item.id, div));
      body.appendChild(div);
    });

    header.addEventListener('click', () => {
      header.classList.toggle('expanded');
      body.classList.toggle('expanded');
    });

    section.appendChild(header);
    section.appendChild(body);
    container.appendChild(section);
  });
}

function buildSummaryBars(containerId, categories) {
  const container = document.getElementById(containerId);
  if (!container) return;
  categories.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'cat-progress';
    row.innerHTML = `
      <div class="cat-progress-label">
        <span>${cat.icon} ${cat.title}</span>
        <span id="bar-fill-label-${cat.id}" style="font-family:monospace;font-size:10px;color:var(--text-muted)">0/${cat.items.length}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-bar-fill" id="bar-fill-${cat.id}" style="width:0%"></div>
      </div>
    `;
    container.appendChild(row);
  });
}

function toggleItem(id, el) {
  if (state.checkedItems.has(id)) {
    state.checkedItems.delete(id);
    el.classList.remove('checked');
  } else {
    state.checkedItems.add(id);
    el.classList.add('checked');
    showToast('✅ Item marcado como conforme');
  }
  updateScoreUI();

  // Update bar-fill-label
  [...CHECKLIST_NR12, ...CHECKLIST_NR06].forEach(cat => {
    const sc = getSectionScore(cat);
    const lbl = document.getElementById('bar-fill-label-' + cat.id);
    if (lbl) lbl.textContent = sc.checked + '/' + sc.total;
  });
}

/* ===================================================
   6. TABS
   =================================================== */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(target)?.classList.add('active');
      state.activeTab = target;
    });
  });
}

/* ===================================================
   7. TOAST
   =================================================== */
function showToast(msg, duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/* ===================================================
   8. THREE.JS — 3D VIEWER
   =================================================== */
let THREE, OBJLoader, MTLLoader, OrbitControls;

async function waitForThree() {
  return new Promise(resolve => {
    const check = () => {
      if (window.THREE && window.THREE.OBJLoader && window.THREE.MTLLoader && window.THREE.OrbitControls) {
        THREE        = window.THREE;
        OBJLoader    = window.THREE.OBJLoader;
        MTLLoader    = window.THREE.MTLLoader;
        OrbitControls = window.THREE.OrbitControls;
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

async function initViewer() {
  await waitForThree();

  const canvas = document.getElementById('canvas-3d');
  const wrap   = document.getElementById('viewport-wrap');

  // Scene
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x0a0d12);
  state.scene.fog = new THREE.FogExp2(0x0a0d12, 0.005);

  // Camera
  const w = wrap.clientWidth, h = wrap.clientHeight;
  state.camera = new THREE.PerspectiveCamera(55, w / h, 0.01, 2000);
  state.camera.position.set(8, 6, 12);

  // Renderer
  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setSize(w, h);
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.2;

  // Controls
  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.06;
  state.controls.minDistance = 0.5;
  state.controls.maxDistance = 500;
  state.controls.maxPolarAngle = Math.PI * 0.85;

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  state.scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.6);
  sunLight.position.set(10, 20, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width  = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far  = 200;
  sunLight.shadow.bias = -0.001;
  state.scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.4);
  fillLight.position.set(-10, 5, -10);
  state.scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xf97316, 0.3);
  rimLight.position.set(0, -5, -15);
  state.scene.add(rimLight);

  // Grid
  buildGrid();

  // Resize handler
  const resizeObserver = new ResizeObserver(() => {
    const nw = wrap.clientWidth, nh = wrap.clientHeight;
    state.camera.aspect = nw / nh;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(nw, nh);
  });
  resizeObserver.observe(wrap);

  // Animate
  function animate() {
    requestAnimationFrame(animate);
    state.controls.update();
    state.renderer.render(state.scene, state.camera);
  }
  animate();
}

function buildGrid() {
  if (state.gridMesh) { state.scene.remove(state.gridMesh); state.gridMesh = null; }
  if (!state.gridVisible) return;

  const grid = new THREE.GridHelper(200, 200, 0xf97316, 0x1e2a38);
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  grid.name = 'grid';
  state.scene.add(grid);
  state.gridMesh = grid;

  // Ground plane
  const planeGeo = new THREE.PlaneGeometry(200, 200);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 1, metalness: 0 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  plane.name = 'ground';
  state.scene.add(plane);
}

/* ===================================================
   9. OBJ PARSER — Chunked para arquivos grandes
   =================================================== */

/**
 * Parseia texto OBJ em chunks usando setTimeout para não
 * bloquear o event loop. Chama onProgress(0-100) e onDone(group).
 */
function parseOBJChunked(text, onProgress, onDone) {
  const lines     = text.split('\n');
  const total     = lines.length;
  const CHUNK     = 50000; // linhas por tick
  let   cursor    = 0;

  // Acumuladores
  const verts   = [];   // Float32 xyz
  const norms   = [];   // Float32 xyz
  const uvs     = [];   // Float32 xy

  // Por objeto atual
  let curName   = 'mesh_0';
  let posArr    = [];
  let normArr   = [];
  let uvArr     = [];
  let hasUV     = false;
  let hasNorm   = false;

  const objects = []; // { name, pos[], norm[], uv[], hasUV, hasNorm }

  function finalizeCurrent() {
    if (posArr.length > 0) {
      objects.push({ name: curName, pos: posArr, norm: normArr, uv: uvArr, hasUV, hasNorm });
    }
    posArr = []; normArr = []; uvArr = []; hasUV = false; hasNorm = false;
  }

  function processChunk() {
    const end = Math.min(cursor + CHUNK, total);

    for (let i = cursor; i < end; i++) {
      const raw = lines[i];
      if (!raw || raw.charCodeAt(0) === 35 /* # */) continue; // skip blank/comment

      const sp  = raw.indexOf(' ');
      if (sp < 0) continue;
      const cmd = raw.substring(0, sp);
      const rest = raw.substring(sp + 1);

      if (cmd === 'v') {
        const p = rest.split(' ');
        verts.push(+p[0], +p[1], +p[2]);

      } else if (cmd === 'vn') {
        const p = rest.split(' ');
        norms.push(+p[0], +p[1], +p[2]);

      } else if (cmd === 'vt') {
        const p = rest.split(' ');
        uvs.push(+p[0], +p[1]);

      } else if (cmd === 'f') {
        // Triangulaçao por fan
        const tokens = rest.trimEnd().split(' ');
        const n = tokens.length;
        if (n < 3) continue;

        // Parse each vertex token once
        const idx = [];
        for (let t = 0; t < n; t++) {
          const tok = tokens[t];
          const sl1 = tok.indexOf('/');
          if (sl1 < 0) {
            idx.push({ v: +tok, vt: undefined, vn: undefined });
          } else {
            const sl2 = tok.indexOf('/', sl1 + 1);
            const vI  = +tok.substring(0, sl1);
            if (sl2 < 0) {
              idx.push({ v: vI, vt: +tok.substring(sl1 + 1), vn: undefined });
            } else {
              const vtStr = tok.substring(sl1 + 1, sl2);
              idx.push({ v: vI, vt: vtStr ? +vtStr : undefined, vn: +tok.substring(sl2 + 1) });
            }
          }
        }

        const pushVert = (ref) => {
          const vi  = (ref.v  >= 0 ? ref.v  - 1 : verts.length / 3 + ref.v ) * 3;
          posArr.push(verts[vi] ?? 0, verts[vi+1] ?? 0, verts[vi+2] ?? 0);

          if (ref.vn !== undefined) {
            const ni = (ref.vn >= 0 ? ref.vn - 1 : norms.length / 3 + ref.vn) * 3;
            normArr.push(norms[ni] ?? 0, norms[ni+1] ?? 0, norms[ni+2] ?? 0);
            hasNorm = true;
          }
          if (ref.vt !== undefined) {
            const ti = (ref.vt >= 0 ? ref.vt - 1 : uvs.length / 2 + ref.vt) * 2;
            uvArr.push(uvs[ti] ?? 0, uvs[ti+1] ?? 0);
            hasUV = true;
          }
        };

        for (let j = 1; j < n - 1; j++) {
          pushVert(idx[0]);
          pushVert(idx[j]);
          pushVert(idx[j + 1]);
        }

      } else if (cmd === 'o' || cmd === 'g') {
        finalizeCurrent();
        curName = rest.trim() || ('mesh_' + objects.length);
      }
    }

    cursor = end;
    const pct = Math.round((cursor / total) * 100);
    onProgress(pct);

    if (cursor < total) {
      setTimeout(processChunk, 0);
    } else {
      // Finalise last object
      finalizeCurrent();

      // Build Three.js Group
      const group = new THREE.Group();
      group.name  = 'OBJModel';

      let totalV = 0, totalF = 0, matCount = 0;

      objects.forEach((obj, oi) => {
        if (obj.pos.length === 0) return;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(obj.pos), 3));

        if (obj.hasNorm && obj.norm.length === obj.pos.length) {
          geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(obj.norm), 3));
        } else {
          geo.computeVertexNormals();
        }

        if (obj.hasUV && obj.uv.length > 0) {
          geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(obj.uv), 2));
        }

        const hue = (oi * 37) % 360;
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(`hsl(${hue},18%,48%)`),
          roughness: 0.65,
          metalness: 0.3,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = obj.name;
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        totalV += obj.pos.length / 3;
        totalF += (obj.pos.length / 3) / 3;
        matCount++;
      });

      state.modelInfo = {
        vertices:  Math.round(totalV),
        faces:     Math.round(totalF),
        objects:   objects.length,
        materials: matCount,
      };

      onDone(group);
    }
  }

  // Kick off
  setTimeout(processChunk, 0);
}

/* ── Finalise model after parsing ─────────────────────── */
function finaliseModel(group, fileName) {
  if (state.currentModel) {
    state.scene.remove(state.currentModel);
    state.currentModel = null;
  }

  updateModelInfoUI();

  const box    = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size   = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale  = maxDim > 0 ? 10 / maxDim : 1;

  group.position.sub(center.multiplyScalar(scale));
  group.scale.setScalar(scale);

  const box2 = new THREE.Box3().setFromObject(group);
  group.position.y -= box2.min.y;

  state.scene.add(group);
  state.currentModel = group;

  const dist = maxDim * scale * 1.5;
  state.camera.position.set(dist, dist * 0.7, dist);
  state.controls.target.set(0, (size.y * scale) * 0.3, 0);
  state.controls.update();

  state.modelLoaded = true;
  document.getElementById('drop-overlay').classList.add('hidden');
  document.getElementById('loading-overlay').classList.remove('active');
  setLoadProgress(0, '');

  updateVpInfoBadge(fileName);
  showToast(`🏭 Modelo "${fileName}" carregado com sucesso!`);
}

/* ===================================================
   9b. PROGRESS UI
   =================================================== */
function setLoadProgress(pct, label) {
  const bar  = document.getElementById('load-progress-bar');
  const txt  = document.getElementById('load-progress-text');
  const pctT = document.getElementById('load-progress-pct');
  if (bar)  bar.style.width  = pct + '%';
  if (txt)  txt.textContent  = label;
  if (pctT) pctT.textContent = pct > 0 ? pct + '%' : '';
}

/* ===================================================
   9c. SERVER AUTO-LOAD (assets/factory.obj)
   =================================================== */
async function tryAutoLoadFromServer() {
  const serverPath = 'assets/factory.obj';
  try {
    // HEAD request to check if file exists
    const head = await fetch(serverPath, { method: 'HEAD' });
    if (!head.ok) return false;

    const contentLength = head.headers.get('content-length');
    const totalBytes = contentLength ? +contentLength : 0;
    const totalMB = totalBytes ? (totalBytes / 1024 / 1024).toFixed(0) : '?';

    showToast(`🔍 Modelo detectado no servidor (${totalMB} MB) — iniciando carregamento…`);
    document.getElementById('loading-overlay').classList.add('active');
    document.getElementById('drop-overlay').classList.add('hidden');
    setLoadProgress(0, `Baixando modelo do servidor… (0 / ${totalMB} MB)`);

    const response = await fetch(serverPath);
    if (!response.ok) throw new Error('HTTP ' + response.status);

    // Stream with progress
    const reader  = response.body.getReader();
    const chunks  = [];
    let received  = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const mb  = (received / 1024 / 1024).toFixed(0);
      const pct = totalBytes ? Math.round((received / totalBytes) * 45) : 0; // 0–45%
      setLoadProgress(pct, `Baixando… ${mb} MB / ${totalMB} MB`);
    }

    setLoadProgress(46, 'Decodificando texto…');
    const blob   = new Blob(chunks);
    const text   = await blob.text();
    chunks.length = 0; // GC hint

    setLoadProgress(48, 'Iniciando parser OBJ…');

    parseOBJChunked(
      text,
      (pct) => {
        // Map parser 0-100 → UI 48-95
        const ui = 48 + Math.round(pct * 0.47);
        setLoadProgress(ui, `Processando geometria… ${pct}%`);
      },
      (group) => {
        setLoadProgress(100, 'Finalizando…');
        setTimeout(() => finaliseModel(group, 'factory.obj'), 100);
      }
    );

    return true;
  } catch (err) {
    console.warn('[AutoLoad] factory.obj não encontrado ou erro:', err);
    return false;
  }
}

function updateVpInfoBadge(name) {
  const badge = document.getElementById('model-name-badge');
  if (badge) badge.textContent = name;
}

function updateModelInfoUI() {
  const fmt = n => n.toLocaleString('pt-BR');
  const mi = state.modelInfo;
  const el = id => document.getElementById(id);
  if (el('info-vertices'))  el('info-vertices').textContent  = fmt(mi.vertices);
  if (el('info-faces'))     el('info-faces').textContent     = fmt(mi.faces);
  if (el('info-objects'))   el('info-objects').textContent   = fmt(mi.objects);
  if (el('info-materials')) el('info-materials').textContent = fmt(mi.materials);
}

/* ===================================================
   10. FILE INPUT / DRAG & DROP
   =================================================== */
function initFileHandling() {
  const dropOverlay = document.getElementById('drop-overlay');
  const vwrap = document.getElementById('viewport-wrap');

  document.getElementById('browse-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('file-input').addEventListener('change', e => {
    handleFiles(e.target.files);
  });

  // Drag & Drop on the whole viewport
  vwrap.addEventListener('dragover', e => {
    e.preventDefault();
    dropOverlay.classList.remove('hidden');
    dropOverlay.classList.add('dragging');
  });

  vwrap.addEventListener('dragleave', e => {
    if (!vwrap.contains(e.relatedTarget)) {
      dropOverlay.classList.remove('dragging');
      if (!state.modelLoaded) dropOverlay.classList.remove('hidden');
    }
  });

  vwrap.addEventListener('drop', e => {
    e.preventDefault();
    dropOverlay.classList.remove('dragging');
    handleFiles(e.dataTransfer.files);
  });

  dropOverlay.addEventListener('dragover', e => {
    e.preventDefault();
    dropOverlay.classList.add('dragging');
  });
  dropOverlay.addEventListener('drop', e => {
    e.preventDefault();
    dropOverlay.classList.remove('dragging');
    handleFiles(e.dataTransfer.files);
  });
}

function handleFiles(files) {
  const fileList = Array.from(files);
  const objFile  = fileList.find(f => f.name.toLowerCase().endsWith('.obj'));

  if (!objFile) {
    showToast('⚠️ Nenhum arquivo .OBJ encontrado. Selecione um arquivo .obj');
    return;
  }

  const sizeMB = (objFile.size / 1024 / 1024).toFixed(0);
  showToast(`📦 Arquivo: ${objFile.name} (${sizeMB} MB) — iniciando leitura…`);

  document.getElementById('loading-overlay').classList.add('active');
  document.getElementById('drop-overlay').classList.add('hidden');
  setLoadProgress(0, `Lendo arquivo… (${sizeMB} MB)`);

  // Use FileReader com progresso
  const reader = new FileReader();

  reader.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 40); // 0–40%
      const mb  = (e.loaded / 1024 / 1024).toFixed(0);
      setLoadProgress(pct, `Lendo arquivo… ${mb} / ${sizeMB} MB`);
    }
  };

  reader.onload = (e) => {
    setLoadProgress(42, 'Decodificando texto OBJ…');
    const arrayBuf = e.target.result;

    // Decode in next tick so progress bar renders
    setTimeout(() => {
      let text;
      try {
        text = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuf));
      } catch(err) {
        showToast('❌ Erro ao decodificar arquivo: ' + err.message);
        document.getElementById('loading-overlay').classList.remove('active');
        if (!state.modelLoaded) document.getElementById('drop-overlay').classList.remove('hidden');
        return;
      }

      setLoadProgress(45, 'Iniciando parser OBJ chunked…');

      parseOBJChunked(
        text,
        (pct) => {
          const ui = 45 + Math.round(pct * 0.5); // 45–95%
          setLoadProgress(ui, `Processando geometria… ${pct}%`);
        },
        (group) => {
          setLoadProgress(100, 'Finalizando…');
          setTimeout(() => finaliseModel(group, objFile.name), 100);
        }
      );
    }, 50);
  };

  reader.onerror = () => {
    showToast('❌ Erro ao ler o arquivo.');
    document.getElementById('loading-overlay').classList.remove('active');
    if (!state.modelLoaded) document.getElementById('drop-overlay').classList.remove('hidden');
    setLoadProgress(0, '');
  };

  reader.readAsArrayBuffer(objFile);
}

/* ===================================================
   11. VIEWPORT TOOLBAR ACTIONS
   =================================================== */
function initToolbarActions() {
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    state.camera.position.multiplyScalar(0.8);
    state.controls.update();
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    state.camera.position.multiplyScalar(1.25);
    state.controls.update();
  });
  document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
    state.camera.position.set(8, 6, 12);
    state.controls.target.set(0, 0, 0);
    state.controls.update();
    showToast('📷 Câmera resetada');
  });
  document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
    const el = document.getElementById('viewport-wrap');
    if (!document.fullscreenElement) { el.requestFullscreen(); }
    else { document.exitFullscreen(); }
  });
  document.getElementById('btn-upload-model')?.addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('btn-print')?.addEventListener('click', () => {
    window.print();
  });
}

/* ===================================================
   12. MODEL SETTINGS TOGGLES
   =================================================== */
function initModelToggles() {
  const gridToggle = document.getElementById('toggle-grid');
  const wireToggle = document.getElementById('toggle-wire');

  gridToggle?.addEventListener('change', () => {
    state.gridVisible = gridToggle.checked;
    buildGrid();
  });

  wireToggle?.addEventListener('change', () => {
    state.wireframeMode = wireToggle.checked;
    if (state.currentModel) {
      state.currentModel.traverse(child => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => { m.wireframe = state.wireframeMode; });
        }
      });
    }
  });
}

/* ===================================================
   13. INIT
   =================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  // Build checklists
  buildChecklist(CHECKLIST_NR12, 'nr12-list');
  buildChecklist(CHECKLIST_NR06, 'nr06-list');
  buildSummaryBars('summary-bars', [...CHECKLIST_NR12, ...CHECKLIST_NR06]);

  // Tabs
  initTabs();

  // Initial score
  updateScoreUI();

  // 3D
  await initViewer();
  initFileHandling();
  initToolbarActions();
  initModelToggles();

  // Tenta carregar factory.obj do servidor automaticamente
  const autoLoaded = await tryAutoLoadFromServer();
  if (!autoLoaded) {
    showToast('🚀 Sistema inicializado — arraste o arquivo factory.obj ou selecione via botão');
  }
});
