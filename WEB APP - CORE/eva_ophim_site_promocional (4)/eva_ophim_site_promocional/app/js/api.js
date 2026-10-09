/* ============================================================
   ASTHA RAVEN ? API Client (api.js)
   Fetch wrapper with auth headers, error handling
   ============================================================ */

const API = {
  _pendingReads: new Map(),
  _readSession: null,
  _redirectingOn401: false,
  // Base URL da API ? detecta dinamicamente a origem
  BASE_URL: (function() {
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.protocol === 'file:') {
        return 'http://localhost:3000/api';
      }
      const hostname = window.location.hostname || 'localhost';
      const port = window.location.port;
      if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname) && ['4173', '5500', '5501'].includes(port)) {
        const apiHostname = hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
        return `http://${apiHostname}:3000/api`;
      }
    }
    return '/api';
  })(),

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('astha_token');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        ...options.headers,
      },
      ...options,
    };

    const controller = options.method === 'GET' && !options.signal ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 20000) : null;
    if (controller) config.signal = controller.signal;
    try {
      const response = await fetch(`${this.BASE_URL}${endpoint}`, config);
      let data = {};
      try { data = response.ok && options.responseType === 'text' ? { content: await response.text() } : await response.json(); } catch(e) {}

      if (response.status === 401 && endpoint !== '/auth/login') {
        // Session expired ? clear token and redirect to login
        if (!this._redirectingOn401) {
          this._redirectingOn401 = true;
          localStorage.removeItem('astha_token');
          localStorage.removeItem('astha_user');
          sessionStorage.setItem('ASTHA_redirect', window.location.pathname + window.location.search);
          if (typeof showToast === 'function') {
            showToast('Sessão expirada. Por favor, faça login novamente.', 'error');
          }
          setTimeout(() => { window.location.href = '/app/login.html'; }, 1200);
        }
        return { success: false, error: data.error || 'Sessão expirada' };
      }

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = Math.max(1, Number(response.headers.get('Retry-After')) || 60);
          return { success: false, status: 429, retryAfter, error: `Muitas solicitações em sequência. Aguarde ${retryAfter} segundos e tente novamente.` };
        }
        const errMsg = data.error || data.message || `HTTP ${response.status}`;
        throw new Error(errMsg);
      }
      return { success: true, ...data, data };
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      return { success: false, error: error.name === 'AbortError' ? 'O carregamento demorou demais. Tente novamente.' : error.message };
    } finally { if (timeout) clearTimeout(timeout); }
  },

  get(endpoint) {
    const session = localStorage.getItem('astha_token');
    if (session !== this._readSession) { this._pendingReads.clear(); this._readSession = session; }
    if (this._pendingReads.has(endpoint)) return this._pendingReads.get(endpoint);
    const pending = this.request(endpoint, { method: 'GET' }).finally(() => {
      if (this._pendingReads.get(endpoint) === pending) this._pendingReads.delete(endpoint);
    });
    this._pendingReads.set(endpoint, pending);
    return pending;
  },
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
};

