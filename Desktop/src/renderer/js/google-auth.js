(() => {
  const root = document.querySelector('[data-google-auth]');
  if (!root) return;
  const message = root.querySelector('.google-auth-status');
  const fallback = root.querySelector('.google-unavailable');
  const host = root.querySelector('.google-button-host');
  let busy = false;
  const status = text => { message.textContent = text; message.hidden = !text; };
  async function start() {
    try {
      const config = await API.get('/auth/oauth/config');
      if (!config.success) throw new Error('Não foi possível conectar o login Google. Recarregue para tentar novamente.');
      if (!config.google?.enabled) { status('Login Google disponível após a configuração do administrador.'); return; }
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        const timeout = setTimeout(() => reject(new Error('O Google demorou para responder. Recarregue a página e tente novamente.')), 15000);
        script.onload = () => { clearTimeout(timeout); resolve(); };
        script.onerror = () => { clearTimeout(timeout); reject(new Error('Não foi possível carregar o Google. Confira sua conexão.')); };
        document.head.append(script);
      });
      google.accounts.id.initialize({ client_id: config.google.clientId, nonce: config.google.nonce, auto_select: false, callback: async response => {
        if (busy) return;
        busy = true;
        host.style.pointerEvents = 'none';
        status('Validando sua conta…');
        try {
          const result = await API.post('/auth/oauth/google', { credential: response.credential, nonce: config.google.nonce });
          if (!result.success || !result.token || !result.user) throw new Error(result.error || 'Não foi possível entrar com Google.');
          localStorage.setItem('astha_token', result.token);
          localStorage.setItem('astha_user', JSON.stringify(result.user));
          let destination = result.user.setup_done ? './home.html' : './onboarding.html';
          const saved = sessionStorage.getItem('ASTHA_redirect');
          sessionStorage.removeItem('ASTHA_redirect');
          if (result.user.setup_done && saved) {
            try { const url = new URL(saved, location.href); if (url.origin === location.origin && url.pathname.startsWith('/app/') && !['/app/login.html','/app/register.html'].includes(url.pathname)) destination = url.pathname + url.search; } catch (_) {}
          }
          location.assign(destination);
        } catch (error) { status(error.message + ' Recarregue a página para tentar novamente.'); }
        finally { busy = false; host.style.pointerEvents = ''; }
      }});
      let lastWidth;
      const render = () => {
        const width = Math.min(400, Math.floor(root.getBoundingClientRect().width));
        if (width <= 0 || width === lastWidth) return;
        lastWidth = width;
        host.replaceChildren();
        google.accounts.id.renderButton(host, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: root.dataset.googleMode === 'signup' ? 'signup_with' : 'continue_with', locale: 'pt-BR', width });
      };
      render();
      if (typeof ResizeObserver === 'function') new ResizeObserver(render).observe(root);
      fallback.hidden = true;
      status('');
    } catch (error) { status(error.message); }
  }
  start();
})();
