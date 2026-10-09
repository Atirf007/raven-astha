/* ============================================================
   EVAH OPHIM — API Client (api.js)
   Fetch wrapper with auth headers, error handling
   ============================================================ */

const API = {
  // Base URL da API — detecta dinamicamente a origem
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
    const token = localStorage.getItem('evah_token');
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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      return { success: true, data };
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
