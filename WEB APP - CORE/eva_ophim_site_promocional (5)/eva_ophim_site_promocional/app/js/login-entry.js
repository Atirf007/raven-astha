(() => {
  const form = document.getElementById('loginForm');
  const password = document.getElementById('password');
  const toggle = document.getElementById('togglePassword');
  const error = document.getElementById('login-error-msg');
  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Ocultar' : 'Mostrar';
    toggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    toggle.setAttribute('aria-pressed', String(show));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Entrando…';
    error.hidden = true;
    try {
      const result = await API.post('/auth/login', { email: form.elements.email.value.trim(), password: password.value });
      if (!result.success || !result.token || !result.user) throw new Error(result.error || 'Não foi possível entrar. Confira seus dados.');
      localStorage.setItem('astha_token', result.token);
      localStorage.setItem('astha_user', JSON.stringify(result.user));
      const path = sessionStorage.getItem('ASTHA_redirect');
      sessionStorage.removeItem('ASTHA_redirect');
      let destination = './home.html';
      try {
        const url = new URL(path || destination, location.href);
        if (url.origin === location.origin && url.pathname.startsWith('/app/') && !['/app/login.html','/app/register.html'].includes(url.pathname)) destination = url.pathname + url.search;
      } catch (_) { /* Invalid saved path uses the home page. */ }
      location.assign(destination);
    } catch (failure) {
      error.textContent = failure.message || 'Não foi possível conectar. Tente novamente.';
      error.hidden = false;
    } finally { button.disabled = false; button.textContent = 'Entrar'; }
  });
})();
