(() => {
  const safeUrl = value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
    catch (_) { return null; }
  };
  const safeImage = value => typeof value === 'string' && value.length <= 400000 && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value) ? value : null;
  document.addEventListener('DOMContentLoaded', async () => {
    let cover = null, uploadId = 0;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-edit'; button.textContent = 'Capa e links'; button.disabled = true;
    document.querySelector('#hasWorkspace .card-header').append(button);
    const coverImage = document.createElement('img'); coverImage.className = 'corporate-cover-image'; coverImage.alt = ''; coverImage.hidden = true;
    document.querySelector('.workspace-brand-cover').append(coverImage);
    const linksView = document.createElement('nav'); linksView.className = 'corporate-links'; linksView.setAttribute('aria-label', 'Links da corporação');
    document.querySelector('.workspace-brand-card').append(linksView);
    const form = document.createElement('form'); form.id = 'corporateDesignForm';
    form.innerHTML = '<p class="settings-help">Personalize a capa e reúna os atalhos usados pela organização.</p><img class="corporate-design-cover" alt="Prévia da capa" hidden><label>Imagem de capa<input type="file" accept="image/png,image/jpeg,image/webp" name="cover_file"><small>PNG, JPG ou WebP, até 5 MB.</small></label><button class="btn-edit" type="button" data-remove-cover>Remover capa</button><div data-link-fields></div><button class="btn-edit" type="button" data-add-link>Adicionar link</button><p role="status" data-design-status></p><button class="btn-save" type="submit">Salvar capa e links</button>';
    document.body.append(form); SettingsDialogs.registerForm(form.id, 'Capa e links da corporação');
    const fields = form.querySelector('[data-link-fields]'), status = form.querySelector('[data-design-status]'), preview = form.querySelector('img'), submit = form.querySelector('[type="submit"]');
    function setCover(value) {
      cover = safeImage(value);
      preview.hidden = !cover;
      if (cover) preview.src = cover; else preview.removeAttribute('src');
    }
    function addLink(link = {}) {
      if (fields.children.length >= 12) { status.textContent = 'O limite é de 12 links.'; return; }
      const row = document.createElement('div'); row.className = 'corporate-link-row';
      const nameLabel = document.createElement('label'); nameLabel.textContent = 'Nome';
      const name = document.createElement('input'); name.className = 'row-input'; name.maxLength = 60; name.required = true; name.value = link.label || ''; name.placeholder = 'Ex.: Slack'; name.dataset.linkLabel = '';
      const urlLabel = document.createElement('label'); urlLabel.textContent = 'Endereço';
      const url = document.createElement('input'); url.className = 'row-input'; url.type = 'url'; url.required = true; url.maxLength = 2048; url.placeholder = 'https://'; url.value = link.url || ''; url.dataset.linkUrl = '';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn-edit'; remove.textContent = 'Remover'; remove.setAttribute('aria-label', 'Remover este link'); remove.addEventListener('click', () => row.remove());
      nameLabel.append(name); urlLabel.append(url); row.append(nameLabel, urlLabel, remove); fields.append(row);
    }
    function render(profile) {
      setCover(profile.cover_image);
      coverImage.hidden = !cover;
      if (cover) coverImage.src = cover; else coverImage.removeAttribute('src');
      fields.replaceChildren(); linksView.replaceChildren();
      (Array.isArray(profile.links) ? profile.links : []).slice(0, 12).forEach(link => {
        const href = safeUrl(link.url);
        if (!href || typeof link.label !== 'string') return;
        addLink(link);
        const anchor = document.createElement('a'); anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
        anchor.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/></svg>';
        anchor.append(document.createTextNode(link.label)); linksView.append(anchor);
      });
    }
    button.addEventListener('click', () => { status.textContent = ''; SettingsDialogs.open(form.id); });
    form.querySelector('[data-add-link]').addEventListener('click', () => addLink());
    form.querySelector('[data-remove-cover]').addEventListener('click', () => { uploadId++; setCover(null); form.elements.cover_file.value = ''; submit.disabled = false; });
    form.elements.cover_file.addEventListener('change', async event => {
      const file = event.target.files?.[0], currentUpload = ++uploadId;
      if (!file) { submit.disabled = false; return; }
      submit.disabled = true;
      try {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5000000) throw new Error('Escolha PNG, JPG ou WebP de até 5 MB.');
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 400;
        const scale = Math.max(1200 / bitmap.width, 400 / bitmap.height);
        canvas.getContext('2d').drawImage(bitmap, (1200 - bitmap.width * scale) / 2, (400 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale); bitmap.close();
        const image = canvas.toDataURL('image/webp', 0.8);
        if (image.length > 400000) throw new Error('A capa ficou grande demais. Escolha outra imagem.');
        if (currentUpload !== uploadId) return;
        setCover(image); status.textContent = 'Capa pronta. Salve para aplicar.';
      } catch (error) { if (currentUpload === uploadId) status.textContent = error.message; }
      finally { if (currentUpload === uploadId) submit.disabled = false; }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (submit.disabled) return;
      const links = [...fields.children].map(row => ({ label: row.querySelector('[data-link-label]').value.trim(), url: safeUrl(row.querySelector('[data-link-url]').value.trim()) }));
      if (links.some(link => !link.label || !link.url)) { status.textContent = 'Informe um nome e um endereço HTTP ou HTTPS sem credenciais para cada link.'; return; }
      submit.disabled = true;
      try {
        const result = await API.put('/org/profile-design', { cover_image: cover, links });
        if (!result.success) { status.textContent = result.error || 'Não foi possível salvar.'; return; }
        render(result.data); SettingsDialogs.close(form.id, 'Capa e links atualizados.');
      } finally { submit.disabled = false; }
    });
    const [profile, user] = await Promise.all([API.get('/org/profile-design'), API.get('/auth/me')]);
    button.hidden = !['admin', 'superadmin'].includes(user.data?.role);
    if (profile.success) { render(profile.data); button.disabled = false; }
    else { button.title = profile.error || 'Não foi possível carregar a personalização.'; }
  });
})();
