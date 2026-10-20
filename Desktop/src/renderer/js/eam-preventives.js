// Calendário local: datas de plano são DATE do banco, sem conversão de fuso.
const eamPlanToday = new Date(), eamPlanLocalToday = `${eamPlanToday.getFullYear()}-${String(eamPlanToday.getMonth() + 1).padStart(2, '0')}-${String(eamPlanToday.getDate()).padStart(2, '0')}`;
const eamPlanState = window.eamPlanState = { assets: [], plans: [], stats: [], runs: [], overviewAvailable: true, assetId: '', month: eamPlanLocalToday.slice(0, 7), day: eamPlanLocalToday, selectedPlanId: null, request: 0 };

function eamPlanDate(value) { return typeof value === 'string' ? value.slice(0, 10) : ''; }
function eamPlanAddDays(date, days) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function eamPlanOccurrences(plan, month) {
  if (!Number(plan.active) || !Number.isSafeInteger(Number(plan.interval_days)) || Number(plan.interval_days) < 1) return [];
  const first = `${month}-01`, end = eamPlanAddDays(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0, 12)).toISOString().slice(0, 10), 1);
  let date = eamPlanDate(plan.next_due_at);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))) return [];
  const days = Number(plan.interval_days);
  if (date < first) { const gap = Math.round((Date.parse(`${first}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000); date = eamPlanAddDays(date, Math.ceil(gap / days) * days); }
  const dates = [];
  for (let n = 0; n < 31 && date < end; n++, date = eamPlanAddDays(date, days)) {const scheduled=window.MaintenanceCalendar?window.MaintenanceCalendar.nextWorking(date,window.MaintenanceCalendar.parse(plan.calendar_json)):date;if(scheduled<end&&!dates.includes(scheduled))dates.push(scheduled);}
  return dates;
}

function toggleEamPlanForm(open) {
  const form = document.getElementById('eamPlanForm');
  if (!form) return;
  form.hidden = !open;
  if (open) { const select = document.getElementById('eamPlanAsset'); if (eamPlanState.assetId) select.value = eamPlanState.assetId; const missing = !eamPlanState.assets.length; document.getElementById('eamPlanNoAssets').hidden = !missing; document.getElementById('eamPlanSubmit').disabled = missing; (missing ? document.querySelector('#eamPlanNoAssets button') : document.getElementById('eamPlanTitle'))?.focus(); }
}

function changeEamPlanAsset() { eamPlanState.assetId = document.getElementById('eamPlanFilterAsset').value; eamPlanState.selectedPlanId = null; loadEamPlanOverview(); }
function moveEamPlanMonth(delta) { const [year, month] = eamPlanState.month.split('-').map(Number), date = new Date(Date.UTC(year, month - 1 + delta, 1)); eamPlanState.month = date.toISOString().slice(0, 7); eamPlanState.day = `${eamPlanState.month}-01`; loadEamPlanOverview(); }

async function renderEamPreventives(assets, plans) {
  eamPlanState.assets = assets;
  eamPlanState.plans = plans;
  const filter = document.getElementById('eamPlanFilterAsset');
  if (!filter) return;
  filter.replaceChildren(new Option('Todos os ativos', ''), ...assets.map(a => new Option(`${a.asset_code} — ${a.name}`, String(a.id))));
  if (eamPlanState.assetId && !assets.some(a => String(a.id) === eamPlanState.assetId)) eamPlanState.assetId = '';
  filter.value = eamPlanState.assetId;
  const prerequisite = document.getElementById('eamPlanNoAssets'), submit = document.getElementById('eamPlanSubmit');
  if (prerequisite) prerequisite.hidden = Boolean(assets.length);
  if (submit) submit.disabled = !assets.length;
  await loadEamPlanOverview();
}

async function loadEamPlanOverview() {
  const request = ++eamPlanState.request;
  if (!eamPlanState.plans.length) {
    eamPlanState.stats = []; eamPlanState.runs = []; eamPlanState.overviewAvailable = true;
    const feedback = document.getElementById('eamPlanFeedback');
    if (feedback) feedback.textContent = eamPlanState.assets.length ? '' : 'Cadastre um ativo ou máquina para criar o primeiro plano preventivo.';
    drawEamPreventives();
    return;
  }
  const query = `?month=${encodeURIComponent(eamPlanState.month)}${eamPlanState.assetId ? `&asset_id=${encodeURIComponent(eamPlanState.assetId)}` : ''}`;
  const result = await API.get(`/eam/plans/overview${query}`);
  if (request !== eamPlanState.request) return;
  eamPlanState.overviewAvailable = result.success;
  eamPlanState.stats = result.success && Array.isArray(result.data?.stats) ? result.data.stats : [];
  eamPlanState.runs = result.success && Array.isArray(result.data?.runs) ? result.data.runs : [];
  const feedback = document.getElementById('eamPlanFeedback');
  if (feedback) feedback.textContent = result.success ? '' : 'O histórico das ordens preventivas está indisponível nesta versão da API. Os planos e as datas previstas continuam visíveis.';
  drawEamPreventives();
}

function eamPlanEntries() {
  const entries = new Map(), plans = eamPlanState.plans.filter(p => !eamPlanState.assetId || String(p.asset_id) === eamPlanState.assetId);
  for (const plan of plans) for (const date of eamPlanOccurrences(plan, eamPlanState.month)) entries.set(`${plan.id}:${date}`, { date, plan, status: 'planned' });
  for (const run of eamPlanState.runs) {
    const plan = plans.find(p => Number(p.id) === Number(run.plan_id));
    if (plan) entries.set(`${plan.id}:${eamPlanDate(run.due_date)}`, { date: eamPlanDate(run.due_date), plan, status: run.work_order_status === 'completed' ? 'completed' : 'generated', workOrderId: run.work_order_id, workOrderStatus: run.work_order_status });
  }
  return [...entries.values()];
}

function eamNode(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }
function eamPlanFormattedDate(date) { const [y, m, d] = eamPlanDate(date).split('-').map(Number); return Number.isFinite(y) && m && d ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d)) : '—'; }

function drawEamPreventives() {
  const state = eamPlanState, asset = state.assets.find(a => String(a.id) === state.assetId), plans = state.plans.filter(p => !state.assetId || String(p.asset_id) === state.assetId), entries = eamPlanEntries();
  document.getElementById('eamPlanAssetName').textContent = asset ? `${asset.asset_code} · ${asset.name}` : `${plans.length} plano(s) em ${state.assets.length} ativo(s)`;
  const generated = state.stats.reduce((sum, row) => sum + Number(row.generated_count || 0), 0), completed = state.stats.reduce((sum, row) => sum + Number(row.completed_count || 0), 0), metrics = document.getElementById('eamPlanMetrics');
  metrics.replaceChildren(...[['Planos cadastrados', plans.length], ['Ordens preventivas geradas', state.overviewAvailable ? generated : '—'], ['Execuções concluídas', state.overviewAvailable ? completed : '—']].map(([label, value]) => { const card = eamNode('div', 'eam-preventive-metric'); card.append(eamNode('span', '', label), eamNode('strong', '', value)); return card; }));
  const progress = eamNode('div', 'eam-preventive-progress'), bar = eamNode('div', 'eam-preventive-progress-bar'), caption = eamNode('span', '', !state.overviewAvailable ? 'Progresso indisponível' : generated ? `${Math.round(completed / generated * 100)}% das ordens geradas concluídas` : 'Ainda não há ordens preventivas geradas'); bar.style.width = `${state.overviewAvailable && generated ? Math.min(100, completed / generated * 100) : 0}%`; progress.append(bar); metrics.append(caption, progress);
  const monthlyCompleted = entries.filter(entry => entry.status === 'completed').length, comparison = eamNode('div', 'eam-preventive-comparison');
  for (const [label, value, className] of [['Previstas no mês', entries.length, 'planned'], ['Concluídas no mês', state.overviewAvailable ? monthlyCompleted : '—', 'completed']]) { const row = eamNode('div', 'eam-preventive-comparison-row'), track = eamNode('div', 'eam-preventive-comparison-track'), fill = eamNode('div', className); fill.style.width = `${state.overviewAvailable && entries.length ? Number(value) / entries.length * 100 : 0}%`; track.append(fill); row.append(eamNode('span', '', `${label}: ${value}`), track); comparison.append(row); }
  metrics.append(comparison);
  const [year, month] = state.month.split('-').map(Number), monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  document.getElementById('eamPlanMonth').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const calendar = document.getElementById('eamPlanCalendar'), firstDay = new Date(year, month - 1, 1).getDay(), days = new Date(year, month, 0).getDate(), cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(eamNode('span', 'eam-preventive-empty'));
  for (let d = 1; d <= days; d++) {
    const date = `${state.month}-${String(d).padStart(2, '0')}`, dayEntries = entries.filter(entry => entry.date === date), button = eamNode('button', 'eam-preventive-day', d);
    button.type = 'button'; button.setAttribute('role', 'gridcell'); button.setAttribute('aria-label', `${eamPlanFormattedDate(date)}: ${dayEntries.length} preventiva(s)`); button.setAttribute('aria-selected', String(state.day === date));
    if (state.day === date) button.classList.add('selected');
    if (dayEntries.length) { const dots = eamNode('span', 'eam-preventive-day-dots'); for (const status of [...new Set(dayEntries.map(e => e.status))]) dots.append(eamNode('i', `eam-dot ${status}`)); button.append(dots); }
    button.addEventListener('click', () => { state.day = date; drawEamPreventives(); }); cells.push(button);
  }
  calendar.replaceChildren(...cells);
  document.getElementById('eamPlanDayTitle').textContent = `Agenda · ${eamPlanFormattedDate(state.day)}`;
  const dayTarget = document.getElementById('eamPlanDayItems'), dayEntries = entries.filter(e => e.date === state.day);
  dayTarget.replaceChildren(...(dayEntries.length ? dayEntries.map(entry => { const item = eamNode('article', 'eam-preventive-item'), status = entry.status === 'completed' ? 'Concluída' : entry.status === 'generated' ? 'Ordem gerada' : 'Prevista'; item.append(eamNode('strong', '', entry.plan.title), eamNode('span', '', `${entry.plan.asset_code} — ${entry.plan.asset_name}`), eamNode('small', `eam-plan-status ${entry.status}`, status)); return item; }) : [eamNode('p', 'eam-preventive-empty-message', 'Nenhuma preventiva nesta data.') ]));
  const list = document.getElementById('eamPlansBody');
  list.replaceChildren(...(plans.length ? plans.map(plan => { const card = eamNode('button', 'eam-preventive-plan'); card.type = 'button'; if (Number(state.selectedPlanId) === Number(plan.id)) card.classList.add('selected'); const counts = state.stats.find(row => Number(row.plan_id) === Number(plan.id)); card.append(eamNode('strong', '', plan.title), eamNode('span', '', `${plan.asset_code} — ${plan.asset_name}`), eamNode('small', '', `A cada ${plan.interval_days} dia(s) · Próxima ${eamPlanFormattedDate(plan.next_due_at)}`), eamNode('small', '', state.overviewAvailable ? `${Number(counts?.completed_count || 0)} concluída(s) de ${Number(counts?.generated_count || 0)} ordem(ns) gerada(s)` : 'Histórico de ordens indisponível')); card.addEventListener('click', () => { state.selectedPlanId = plan.id; const due = eamPlanDate(plan.next_due_at); if (due) { state.day = due; if (due.slice(0, 7) !== state.month) { state.month = due.slice(0, 7); loadEamPlanOverview(); return; } } drawEamPreventives(); }); return card; }) : [eamNode('p', 'eam-preventive-empty-message', 'Nenhum plano cadastrado para este ativo. Use “Novo plano” para começar.') ]));
}

if (typeof module !== 'undefined') module.exports = { eamPlanOccurrences, eamPlanAddDays, toggleEamPlanForm };
