/* ============================================================
   ASTAH RAVEN ? API Client (api.js)
   Fetch wrapper with auth headers, error handling
   ============================================================ */

const API = {
  // Base URL da API ? detecta dinamicamente a origem
  BASE_URL: (function() {
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

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('astah_token');
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

    try {
      const response = await fetch(`${this.BASE_URL}${endpoint}`, config);
      let data = {};
      try { data = await response.json(); } catch(e) {}

      if (response.status === 401) {
        // Session expired ? clear token and redirect to login
        localStorage.removeItem('astah_token');
        if (typeof showToast === 'function') {
          showToast('Sessão expirada. Por favor, faça login novamente.', 'error');
        }
        setTimeout(() => { window.location.href = '/'; }, 2000);
        return { success: false, error: data.error || 'Sessão expirada' };
      }

      if (!response.ok) {
        const errMsg = data.error || data.message || `HTTP ${response.status}`;
        throw new Error(errMsg);
      }
      return { success: true, ...data, data };
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      return { success: false, error: error.message };
    }
  },

  get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
};

