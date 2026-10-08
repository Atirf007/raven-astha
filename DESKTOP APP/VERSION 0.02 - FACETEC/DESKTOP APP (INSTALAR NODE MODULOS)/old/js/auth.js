/* ============================================================
   EVAH OPHIM — Auth (auth.js)
   Login, Register, OAuth (Google/Microsoft), route guard
   ============================================================ */

const Auth = {
  API_BASE: (function() {
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.protocol === 'file:') {
        return 'http://localhost:3000/api';
      }
      const hostname = window.location.hostname || 'localhost';
      if (window.location.port !== '3000') {
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
  setToken(token) { localStorage.setItem('evah_token', token); },
  getToken() { return localStorage.getItem('evah_token'); },
  removeToken() { localStorage.removeItem('evah_token'); localStorage.removeItem('evah_user'); },
  setUser(user) {
    // NEVER store sensitive fields like password_hash
    const safe = { id: user.id, name: user.name, email: user.email, role: user.role, org_id: user.org_id, org_name: user.org_name, avatar_url: user.avatar_url, position_label: user.position_label };
    localStorage.setItem('evah_user', JSON.stringify(safe));
  },
  getUser() { try { return JSON.parse(localStorage.getItem('evah_user')); } catch { return null; } },
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
      sessionStorage.setItem('evah_redirect', window.location.pathname);
      window.location.href = '/evah/login.html';
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
          return { success: true, user: data.user, redirect: data.redirect || '/evah/onboarding.html' };
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
        return { success: true, user: result.user, redirect: result.redirect || '/evah/onboarding.html' };
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
        console.warn('[Auth] Google SDK not loaded. Using OAuth redirect fallback.');
        // Redirect-based OAuth fallback
        const redirectUri = window.location.origin + '/evah/login.html';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${this.GOOGLE_CLIENT_ID}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=token` +
          `&scope=${encodeURIComponent('openid email profile')}` +
          `&prompt=select_account`;

        if (this.GOOGLE_CLIENT_ID.includes('YOUR_')) {
          showToast('Configure o Google Client ID em auth.js', 'warning');
          resolve({ success: false, error: 'Google Client ID não configurado' });
        } else {
          window.location.href = authUrl;
          resolve({ success: true });
        }
        return;
      }

      // GIS Popup flow
      google.accounts.id.initialize({
        client_id: this.GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (response.credential) {
            // Decode JWT payload
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            const user = {
              id: Date.now(),
              name: payload.name || payload.email.split('@')[0],
              email: payload.email,
              role: 'viewer',
              avatar_url: payload.picture || null,
              provider: 'google'
            };
            Auth.setToken('google_' + response.credential.substring(0, 50));
            Auth.setUser(user);

            // Try to register/login on backend
            try {
              await fetch(`${Auth.API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: user.name, email: user.email,
                  password: 'oauth_' + Date.now(), company: '', phone: ''
                })
              });
            } catch (_) { /* Backend may be offline */ }

            resolve({ success: true, user });
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
    if (this.AZURE_CLIENT_ID.includes('YOUR_')) {
      showToast('Configure o Microsoft Client ID em auth.js', 'warning');
      return { success: false, error: 'Microsoft Client ID não configurado' };
    }

    const redirectUri = window.location.origin + '/evah/login.html';
    const scope = 'openid email profile User.Read';
    const authUrl = `https://login.microsoftonline.com/${this.AZURE_TENANT_ID}/oauth2/v2.0/authorize?` +
      `client_id=${this.AZURE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=id_token token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_mode=fragment` +
      `&nonce=${Date.now()}`;

    window.location.href = authUrl;
    return { success: true };
  },

  // ── Handle OAuth redirect (callback) ──
  handleOAuthCallback() {
    const hash = window.location.hash;
    if (!hash) return false;

    const params = new URLSearchParams(hash.substring(1));

    // Google implicit flow token
    const accessToken = params.get('access_token');
    if (accessToken && !params.get('id_token')) {
      // Google — fetch user info
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then(r => r.json())
      .then(profile => {
        const user = {
          id: Date.now(),
          name: profile.name || profile.email.split('@')[0],
          email: profile.email,
          role: 'viewer',
          avatar_url: profile.picture || null,
          provider: 'google'
        };
        this.setToken('google_' + accessToken.substring(0, 50));
        this.setUser(user);
        showToast('Login com Google realizado!', 'success');
        window.location.hash = '';
        setTimeout(() => { window.location.href = '/evah/home/index.html'; }, 800);
      })
      .catch(() => showToast('Erro ao obter perfil do Google', 'error'));
      return true;
    }

    // Microsoft Entra ID — id_token
    const idToken = params.get('id_token');
    if (idToken) {
      try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        const user = {
          id: Date.now(),
          name: payload.name || payload.preferred_username,
          email: payload.email || payload.preferred_username,
          role: 'viewer',
          avatar_url: null,
          provider: 'microsoft'
        };
        this.setToken('ms_' + idToken.substring(0, 50));
        this.setUser(user);
        showToast('Login com Microsoft realizado!', 'success');
        window.location.hash = '';
        setTimeout(() => { window.location.href = '/evah/home/index.html'; }, 800);
      } catch (e) {
        showToast('Erro ao processar login Microsoft', 'error');
      }
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
    localStorage.removeItem('evah_user');
    localStorage.removeItem('evah_redirect');
    window.location.href = '/evah/login.html';
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
        const redirect = result.redirect || localStorage.getItem('evah_redirect') || '/evah/home/index.html';
        localStorage.removeItem('evah_redirect');
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
        setTimeout(() => { window.location.href = '/evah/home/index.html'; }, 800);
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
        setTimeout(() => { window.location.href = '/evah/home/index.html'; }, 800);
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
      if (password.length < 8) { showToast('Senha deve ter no mínimo 8 caracteres.', 'error'); return; }

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
        const redirect = result.redirect || '/evah/onboarding.html';
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

  if (!window.PublicKeyCredential) {
    showToast('WebAuthn não suportado neste navegador', 'error');
    return;
  }

  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!available) {
    showToast('Windows Hello / biometria não disponível', 'warning');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Aguardando...';

  try {
    const storedCred = localStorage.getItem('evah_webauthn_cred');

    if (storedCred) {
      const credData = JSON.parse(storedCred);
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: location.hostname,
          allowCredentials: [{ type: 'public-key', id: Uint8Array.from(atob(credData.id), c => c.charCodeAt(0)), transports: ['internal'] }],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (assertion) {
        const user = { id: 1, name: credData.userName, email: credData.email, role: 'admin', avatar_url: null, provider: 'webauthn' };
        Auth.setToken('webauthn_verified_' + Date.now());
        Auth.setUser(user);
        showToast('Autenticação biométrica realizada!', 'success');
        setTimeout(() => { window.location.href = '/evah/home/index.html'; }, 600);
        return;
      }
    } else {
      const email = document.getElementById('loginEmail')?.value?.trim() || 'admin@evah.com';
      const userName = email.split('@')[0];
      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'EVAH OPHIM', id: location.hostname },
          user: { id: userId, name: email, displayName: userName },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
          timeout: 60000
        }
      });

      if (credential) {
        const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        localStorage.setItem('evah_webauthn_cred', JSON.stringify({ id: credId, email, userName }));
        const user = { id: 1, name: userName, email, role: 'admin', avatar_url: null, provider: 'webauthn' };
        Auth.setToken('webauthn_registered_' + Date.now());
        Auth.setUser(user);
        showToast('Digital/PIN registrado! Use para próximos logins.', 'success');
        setTimeout(() => { window.location.href = '/evah/home/index.html'; }, 800);
        return;
      }
    }
  } catch (err) {
    console.warn('[WebAuthn]', err);
    if (err.name === 'NotAllowedError') {
      showToast('Autenticação cancelada pelo usuário', 'warning');
    } else {
      showToast('Erro na autenticação biométrica', 'error');
    }
  }

  btn.disabled = false;
  btn.textContent = 'Digital / PIN';
}
