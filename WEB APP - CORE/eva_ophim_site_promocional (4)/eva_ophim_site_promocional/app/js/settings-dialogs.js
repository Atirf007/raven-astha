(() => {
  const dialogs = new Map();
  const make = (tag, text, className) => {
    const item = document.createElement(tag);
    if (text) item.textContent = text;
    if (className) item.className = className;
    return item;
  };
  function open(id, title) {
    const dialog = dialogs.get(id);
    if (!dialog || dialog.open) return;
    if (title) dialog.querySelector('h2').textContent = title;
    dialog.showModal();
    document.body.classList.add('corporate-modal-open');
  }
  function close(id, message) {
    dialogs.get(id)?.close();
    if (message) {
      let feedback = document.getElementById('corporateFeedback');
      if (!feedback) {
        feedback = make('p', '', 'corporate-feedback'); feedback.id = 'corporateFeedback'; feedback.setAttribute('role', 'status');
      }
      document.querySelector('.tab-content.active')?.prepend(feedback);
      feedback.textContent = message;
    }
  }
  function action(parent, text, id, formId) {
    const button = make('button', text, 'btn-edit corporate-action');
    button.type = 'button';
    if (id) button.id = id;
    button.addEventListener('click', () => open(formId));
    parent.append(button);
    return button;
  }
  function moveForm(id, title) {
    const form = document.getElementById(id);
    const dialog = make('dialog', '', 'corporate-dialog');
    dialog.setAttribute('aria-labelledby', `${id}Title`);
    const header = make('header', '', 'corporate-dialog-header');
    const heading = make('h2', title); heading.id = `${id}Title`;
    const dismiss = make('button', '', 'corporate-dialog-close');
    dismiss.type = 'button'; dismiss.setAttribute('aria-label', 'Fechar janela');
    dismiss.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    dismiss.addEventListener('click', () => dialog.close());
    header.append(heading, dismiss);
    dialog.append(header, form);
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      const bounds = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (!document.querySelector('dialog.corporate-dialog[open]')) document.body.classList.remove('corporate-modal-open');
    });
    dialogs.set(id, dialog);
  }
  function openPanel(title, content) {
    let panel = document.getElementById('corporateMemberAccess');
    if (!panel) {
      panel = make('form'); panel.id = 'corporateMemberAccess';
      document.body.append(panel); moveForm(panel.id, title);
      panel.addEventListener('submit', event => event.preventDefault());
    }
    panel.replaceChildren(content);
    open(panel.id, title);
  }
  function renderCompany(org) {
    const target = document.getElementById('corporateCompanySummary');
    if (!target) return;
    target.replaceChildren();
    for (const [label, value] of [['Razão social', org.name], ['CNPJ', org.cnpj], ['E-mail', org.email], ['Telefone', org.phone], ['Endereço', [org.address, org.city, org.state].filter(Boolean).join(' · ')]]) {
      const entry = make('div'); entry.append(make('dt', label), make('dd', value || 'Não informado')); target.append(entry);
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    const groupNew = document.getElementById('orgNewGroup');
    document.querySelector('#workspaceGroupsCard .card-header').append(groupNew);
    moveForm('workspaceForm', 'Editar empresa e identidade');
    moveForm('orgUnitForm', 'Unidade organizacional');
    moveForm('orgGroupForm', 'Grupo de acesso');
    moveForm('workspaceInviteForm', 'Convidar pessoa');
    moveForm('workspaceTeamForm', 'Adicionar posição à equipe');
    moveForm('workspacePositionForm', 'Cadastrar cargo');
    const summary = make('dl', '', 'corporate-company-summary'); summary.id = 'corporateCompanySummary';
    document.getElementById('hasWorkspace').append(summary);
    action(document.querySelector('#hasWorkspace .card-header'), 'Editar dados', 'corporateEditCompany', 'workspaceForm');
    action(document.querySelector('#workspaceInviteCard .card-header'), 'Novo convite', null, 'workspaceInviteForm');
    const teamActions = make('div', '', 'corporate-team-actions');
    action(teamActions, 'Adicionar posição', 'corporateAddPerson', 'workspaceTeamForm');
    action(teamActions, 'Cadastrar cargo', 'corporateAddPosition', 'workspacePositionForm');
    document.querySelector('#workspaceTeamCard .card-header').append(teamActions);
    document.getElementById('workspaceTeamEditor').hidden = true;
    document.getElementById('workspacePositionsEditor').hidden = true;
    const members = document.getElementById('tab-members');
    const nav = make('nav', '', 'corporate-categories'); nav.setAttribute('aria-label', 'Categorias de equipe');
    const categories = [['Pessoas', 'workspaceMembersCard'], ['Grupos de acesso', 'workspaceGroupsCard'], ['Convites', 'workspaceInviteCard'], ['Organograma', 'workspaceTeamCard']];
    categories.forEach(([label, id], index) => {
      const button = make('button', label); button.type = 'button';
      const select = () => {
        categories.forEach(([, cardId]) => { document.getElementById(cardId).classList.toggle('corporate-category-hidden', cardId !== id); });
        [...nav.children].forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      };
      button.addEventListener('click', select); nav.append(button); if (!index) select();
    });
    members.querySelector('h1').after(nav);
  });
  window.SettingsDialogs = { open, close, renderCompany, openPanel, registerForm: moveForm };
})();
