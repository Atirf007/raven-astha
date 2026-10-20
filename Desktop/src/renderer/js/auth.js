/* ============================================================
   ASTHA RAVEN — Auth (auth.js)
   Login, Register, OAuth (Google/Microsoft), route guard
   ============================================================ */

const Auth = {
  API_BASE: (function() {
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.protocol === 'file:') {
        return 'http://localhost:3000/api';
      }
      const hostname = window.location.hostname || 'localhost';
      if (['localhost', '127.0.0.1'].includes(hostname) && ['4173', '5500', '5501'].includes(window.location.port)) {
        return `http://${hostname}:3000/api`;
      }
    }
    return '/api';
  })(),

  // ── Configuration ──
  // Google OAuth — configure your Client ID at https://console.cloud.google.com/apis/credentials
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  // Microsoft Entra ID
  AZURE_TENANT_ID: 'YOUR_TENANT_ID',
  AZURE_CLIENT_ID: 'YOUR_CLIENT_ID',

  // ── User roles ──
  ROLES: { SUPERADMIN: 'superadmin', ADMIN: 'admin', MANAGER: 'manager', OPERATOR: 'operator', VIEWER: 'viewer' },

  // ── Token / User storage (localStorage — persists across tabs) ──
  setToken(token) { localStorage.setItem('astha_token', token); },
  getToken() { return localStorage.getItem('astha_token'); },
  removeToken() { localStorage.removeItem('astha_token'); localStorage.removeItem('astha_user'); },
  setUser(user) {
    // NEVER store sensitive fields like password_hash
    const safe = { id: user.id, name: user.name, surname: user.surname, email: user.email, role: user.role, org_id: user.org_id, org_name: user.org_name, org_logo: user.org_logo, org_plan: user.org_plan, avatar_url: user.avatar_url, position_label: user.position_label, plan: typeof user.plan === 'string' ? user.plan : undefined };
    localStorage.setItem('astha_user', JSON.stringify(safe));
  },
  getUser() { try { return JSON.parse(localStorage.getItem('astha_user')); } catch { return null; } },
  isAuthenticated() { return !!this.getToken(); },
  // NOTE: role from localStorage is used ONLY for UI hints, never for actual security decisions (server enforces)
  getUserRole() { const u = this.getUser(); return u?.role || 'viewer'; },
  isAdmin() { const r = this.getUserRole(); return r === 'admin' || r === 'superadmin'; },

  // ── Permission checks ──
  canAdd() { const r = this.getUserRole(); return r === 'superadmin' || r === 'admin' || r === 'manager' || r === 'operator'; },
  canRemove() { const r = this.getUserRole(); return r === 'superadmin' || r === 'admin' || r === 'manager' || r === 'operator'; },
  canEdit() { const r = this.getUserRole(); return r === 'superadmin' || r === 'admin' || r === 'manager'; },
  canManageUsers() { const r = this.getUserRole(); return r === 'superadmin' || r === 'admin'; },
  canViewAll() { return true; },

  // ── Route Guard ──
  requireAuth() {
    if (!this.isAuthenticated()) {
      sessionStorage.setItem('ASTHA_redirect', window.location.pathname);
      window.location.href = '/app/login.html';
      return false;
    }
    return true;
  },

  // ── Login via API ──
  async login(email, password) {
    try {
      const res = await fetch(`${this.API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        this.setToken(data.token);
        this.setUser(data.user);
        // Redirect to onboarding if setup not done
        if (data.setup_done === false) {
          return { success: true, user: data.user, redirect: data.redirect || '/app/onboarding.html' };
        }
        return { success: true, user: data.user, redirect: null };
      }
      return { success: false, error: data.error || 'Credenciais inválidas' };
    } catch (err) {
      console.error('[Auth] Login error:', err);
    return { success: false, error: 'Servidor indisponível. Verifique se o servidor está rodando.' };
    }
  },


  // ── Register via API ──
  async register(data) {
    try {
      const res = await fetch(`${this.API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          surname: data.surname,
          email: data.email,
          password: data.password,
          invite_code: data.invite_code || undefined
        })
      });
      const result = await res.json();
      if (res.ok && result.token) {
        this.setToken(result.token);
        this.setUser(result.user);
        // Always redirect to onboarding on register
        return { success: true, user: result.user, redirect: result.redirect || '/app/onboarding.html' };
      }
      return { success: false, error: result.error || 'Erro ao registrar' };
    } catch (err) {
      console.error('[Auth] Register error:', err);
      return { success: false, error: 'Servidor indisponível. Verifique se o servidor está rodando.' };
    }
  },

  // ── OAuth2: Google via Google Identity Services (GIS) ──
  async loginWithGoogle() {
    return new Promise((resolve) => {
      // Check if Google SDK is loaded
      if (typeof google === 'undefined' || !google.accounts) {
        showToast('Login Google indisponível: SDK não carregado', 'warning');
        resolve({ success: false, error: 'Google Identity Services indisponível' });
        return;
      }

      // GIS Popup flow
      google.accounts.id.initialize({
        client_id: this.GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (response.credential) {
            try {
              const backend = await fetch(`${Auth.API_BASE}/auth/oauth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
              });
              const data = await backend.json();
              if (!backend.ok || !data.token || !data.user) throw new Error(data.error || 'Credencial rejeitada');
              Auth.setToken(data.token); Auth.setUser(data.user);
              resolve({ success: true, user: data.user });
            } catch (error) { resolve({ success: false, error: error.message || 'Login Google falhou' }); }
          } else {
            resolve({ success: false, error: 'Google login cancelado' });
          }
        }
      });
      google.accounts.id.prompt();
    });
  },

  // ── OAuth2: Microsoft (Entra ID) ──
  async loginWithMicrosoft() {
    let provider;
    try { const response=await fetch(this.API_BASE+'/auth/oauth/microsoft/config');provider=await response.json();if(!response.ok||!provider.enabled)throw Error(); }
    catch(_){return {success:false,error:'Login Microsoft indisponível. Confira a configuração do provedor.'};}
    sessionStorage.setItem('astha_oauth_nonce',provider.nonce);

    const redirectUri = window.location.origin + '/app/login.html';
    const scope = 'openid email profile';
    const authUrl = `https://login.microsoftonline.com/${provider.tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${provider.clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=id_token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_mode=fragment` +
      `&nonce=${encodeURIComponent(provider.nonce)}`;

    window.location.href = authUrl;
    return { success: true };
  },

  // ── Handle OAuth redirect (callback) ──
  createOAuthNonce() {
    const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
    const nonce = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('astha_oauth_nonce', nonce); return nonce;
  },

  handleOAuthCallback() {
    const hash = window.location.hash;
    if (!hash) return false;

    const params = new URLSearchParams(hash.substring(1));

    // Microsoft Entra ID — id_token
    const idToken = params.get('id_token');
    if (idToken) {
      const expectedNonce = sessionStorage.getItem('astha_oauth_nonce');
      let payload;
      try { payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
      catch (_) { showToast('Resposta Microsoft inválida', 'error'); return true; }
      sessionStorage.removeItem('astha_oauth_nonce');
      if (!expectedNonce || payload.nonce !== expectedNonce) { showToast('Resposta Microsoft não corresponde ao login iniciado', 'error'); return true; }
      fetch(`${this.API_BASE}/auth/oauth/microsoft`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id_token:idToken,nonce:expectedNonce}) })
        .then(async r => ({ok:r.ok, data:await r.json()}))
        .then(({ok,data}) => { if (!ok || !data.token || !data.user) throw new Error(data.error); this.setToken(data.token); this.setUser(data.user); window.location.hash=''; window.location.href='/app/home.html'; })
        .catch(() => showToast('Login Microsoft rejeitado', 'error'));
      return true;
    }

    return false;
  },

  // ── Logout ──
  async logout() {
    try {
      const token = this.getToken();
      if (token) {
        await fetch(`${this.API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (_) { /* ignore */ }
    this.removeToken();
    localStorage.removeItem('astha_user');
    localStorage.removeItem('ASTHA_redirect');
    window.location.href = '/app/login.html';
  }
};

// ── Form Handlers ──
document.addEventListener('DOMContentLoaded', () => {
  // Handle OAuth redirects first
  if (Auth.handleOAuthCallback()) return;

  // Login Form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (Security.isRateLimited('login', 5, 60000)) {
        showToast('Muitas tentativas. Aguarde 1 minuto.', 'error');
        return;
      }
      const rawEmail = document.getElementById('loginEmail').value.trim();
      const email = Security.sanitizeHTML(rawEmail);
      const password = document.getElementById('loginPassword').value;

      if (!Security.isValidEmail(email)) { showToast('Email inválido', 'error'); return; }

      const btn = loginForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Entrando...';

      const result = await Auth.login(email, password);
      if (result.success) {
        showToast('Login realizado com sucesso!', 'success');
        // Respect onboarding redirect from server
        const redirect = result.redirect || localStorage.getItem('ASTHA_redirect') || '/app/home.html';
        localStorage.removeItem('ASTHA_redirect');
        setTimeout(() => { window.location.href = redirect; }, 800);
      } else {
        showToast(result.error, 'error');
        btn.disabled = false; btn.textContent = 'Entrar';
      }
    });
  }

  // Google Login
  const googleBtn = document.getElementById('googleLogin');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      googleBtn.disabled = true; googleBtn.textContent = 'Conectando...';
      const result = await Auth.loginWithGoogle();
      if (result.success && result.user) {
        showToast('Login com Google realizado!', 'success');
        setTimeout(() => { window.location.href = '/app/home.html'; }, 800);
      } else if (!result.success) {
        googleBtn.disabled = false; googleBtn.textContent = 'Google';
      }
    });
  }

  // Google Register (same flow)
  const googleRegBtn = document.getElementById('googleRegister');
  if (googleRegBtn) {
    googleRegBtn.addEventListener('click', async () => {
      googleRegBtn.disabled = true; googleRegBtn.textContent = 'Conectando...';
      const result = await Auth.loginWithGoogle();
      if (result.success && result.user) {
        showToast('Conta criada com Google!', 'success');
        setTimeout(() => { window.location.href = '/app/home.html'; }, 800);
      } else if (!result.success) {
        googleRegBtn.disabled = false; googleRegBtn.textContent = 'Google';
      }
    });
  }

  // Microsoft Login
  const msBtn = document.getElementById('microsoftLogin');
  if (msBtn) {
    msBtn.addEventListener('click', async () => {
      msBtn.disabled = true; msBtn.textContent = 'Conectando...';
      await Auth.loginWithMicrosoft();
    });
  }

  // Microsoft Register
  const msRegBtn = document.getElementById('microsoftRegister');
  if (msRegBtn) {
    msRegBtn.addEventListener('click', async () => {
      msRegBtn.disabled = true; msRegBtn.textContent = 'Conectando...';
      await Auth.loginWithMicrosoft();
    });
  }

  // Register Form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (Security.isRateLimited('register', 3, 60000)) { showToast('Aguarde antes de tentar novamente.', 'warning'); return; }
      const terms = document.getElementById('regTerms');
      if (terms && !terms.checked) { showToast('Aceite os termos para continuar.', 'warning'); return; }

      const password = document.getElementById('regPassword')?.value;
      const confirmPassword = document.getElementById('regPasswordConfirm')?.value;
      if (password !== confirmPassword) { showToast('As senhas não coincidem.', 'error'); return; }
      if ([...password].length < 15) { showToast('Senha deve ter no mínimo 15 caracteres.', 'error'); return; }

      const data = Security.sanitizeFormData({
        name: document.getElementById('regName').value,
        surname: document.getElementById('regSurname').value,
        email: document.getElementById('regEmail').value,
        password: password,
        company: document.getElementById('regCompany')?.value || '',
        phone: document.getElementById('regPhone')?.value || ''
      });

      const btn = registerForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Criando conta...';

      const result = await Auth.register(data);
      if (result.success) {
        showToast('Conta criada com sucesso!', 'success');
        const redirect = result.redirect || '/app/onboarding.html';
        setTimeout(() => { window.location.href = redirect; }, 1000);
      } else {
        showToast(result.error || 'Erro ao criar conta', 'error');
        btn.disabled = false; btn.textContent = 'Criar Conta';
      }
    });
  }
});

// ── WebAuthn: Windows Hello / PIN / Fingerprint ──
async function webAuthnLogin() {
  const btn = document.getElementById('webauthnLogin');
  if (!btn) return;
  showToast('Login biométrico requer suporte do servidor e está temporariamente indisponível', 'warning');
}


