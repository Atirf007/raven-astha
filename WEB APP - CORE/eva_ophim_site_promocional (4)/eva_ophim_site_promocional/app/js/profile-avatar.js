const ProfileAvatar = {
  fromResponse(response) {
    return response?.success && response.data?.id ? response.data : null;
  },
  render(element, user) {
    if (!element) return;
    const name = typeof user?.name === 'string' ? user.name.trim() : '';
    const fallback = name ? name.charAt(0).toUpperCase() : 'U';
    element.replaceChildren();
    element.textContent = fallback;

    const rawUrl = typeof user?.avatar_url === 'string' ? user.avatar_url.trim() : '';
    if (!rawUrl) return;
    let source;
    if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(rawUrl)) {
      source = rawUrl;
    } else {
      try {
        const parsed = new URL(rawUrl, window.location.href);
        const localPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname)
          && ['localhost', '127.0.0.1'].includes(parsed.hostname)
          && parsed.port === '3000';
        if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && (parsed.origin === window.location.origin || localPreview))) {
          source = parsed.href;
        }
      } catch (_) { /* Invalid avatar URL: show initial. */ }
    }
    if (!source) return;

    const image = document.createElement('img');
    image.alt = '';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit';
    image.onerror = () => { element.replaceChildren(); element.textContent = fallback; };
    element.replaceChildren(image);
    image.src = source;
  }
};

const OrganizationBrand = {
  imageSource(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw) && raw.length <= 50_000) return raw;
    try {
      const parsed = new URL(raw, `${window.location.origin}/`);
      const sameOrigin = parsed.origin === window.location.origin;
      const localImageHost = ['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.port === '3000';
      if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && (sameOrigin || localImageHost))) return parsed.href;
    } catch (_) { /* Invalid organization logo: keep the text mark. */ }
    return '';
  },
  setImage(element, value) {
    if (!element) return false;
    const source = this.imageSource(value);
    if (!source) {
      element.removeAttribute('src');
      element.hidden = true;
      element.style.display = 'none';
      return false;
    }
    element.referrerPolicy = 'no-referrer';
    element.decoding = 'async';
    element.onerror = () => {
      element.hidden = true;
      element.style.display = 'none';
      element.removeAttribute('src');
      const initial = element.parentElement?.querySelector('[data-workspace-initial]');
      if (initial) { initial.hidden = false; initial.style.display = ''; }
      const brand = element.closest('[data-app-brand]');
      if (brand) {
        const companyBrand = brand.querySelector('[data-brand-company]');
        const defaultBrand = brand.querySelector('[data-brand-default]');
        const brandInitial = brand.querySelector('[data-brand-initial]');
        if (companyBrand) companyBrand.hidden = true;
        if (defaultBrand) defaultBrand.hidden = false;
        if (brandInitial) brandInitial.hidden = false;
      }
    };
    element.src = source;
    element.hidden = false;
    element.style.display = 'block';
    return true;
  },
  render(element, user) {
    if (!element) return;
    const name = typeof user?.org_name === 'string' ? user.org_name.trim() : '';
    const image = element.querySelector('[data-workspace-logo]');
    const initial = element.querySelector('[data-workspace-initial]');
    const label = element.querySelector('[data-workspace-name]');
    if (label) label.textContent = name || 'Workspace';
    if (initial) initial.textContent = name ? name.charAt(0).toUpperCase() : 'W';
    const shown = this.setImage(image, user?.org_logo);
    if (initial) initial.hidden = shown;
    element.hidden = !name && !shown;
    if (name) element.title = name;
  },
  renderApplicationBrand(element, user) {
    if (!element) return;
    const name = typeof user?.org_name === 'string' ? user.org_name.trim() : '';
    const image = element.querySelector('[data-brand-logo]');
    const initial = element.querySelector('[data-brand-initial]');
    const label = element.querySelector('[data-brand-name]');
    const plan = element.querySelector('[data-brand-plan]');
    const defaultPlan = element.querySelector('[data-brand-default-plan]');
    const defaultBrand = element.querySelector('[data-brand-default]');
    const companyBrand = element.querySelector('[data-brand-company]');
    const hasLogo = Boolean(this.imageSource(user?.org_logo));
    if (label) label.textContent = name || 'Organização';
    if (initial) initial.textContent = name ? name.charAt(0).toUpperCase() : 'O';
    const rawPlan = String(user?.org_plan || user?.plan || '').trim().toLowerCase();
    const planLabels = { enterprise: 'Enterprise', pro: 'Pro', plus: 'Plus', free: 'Free', starter: 'Free' };
    const planLabel = planLabels[rawPlan] || (rawPlan ? rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1) : 'Free');
    if (plan) plan.textContent = planLabel;
    if (defaultPlan) defaultPlan.textContent = planLabel;
    this.setImage(image, user?.org_logo);
    if (initial) initial.hidden = hasLogo;
    if (companyBrand) companyBrand.hidden = !hasLogo;
    if (defaultBrand) defaultBrand.hidden = hasLogo;
    element.setAttribute('aria-label', hasLogo ? `${name || 'Organização'} · ${plan?.textContent || 'Free'}` : 'ASTHA PRO');
    element.title = hasLogo ? `${name || 'Organização'} · ${plan?.textContent || 'Free'}` : 'ASTHA PRO';
  }
};
