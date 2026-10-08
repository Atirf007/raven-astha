/* ============================================================
   ASTAH RAVEN ? Security (security.js)
   Sanitização de inputs, CSRF, rate limiting
   ============================================================ */

const Security = {
  // ???? Sanitize HTML input (XSS prevention) ????
  sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  },

  // ???? Escape special characters ????
  escapeHTML(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, c => map[c]);
  },

  // ???? Validate email format ????
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  // ???? Password strength checker ????
  getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { level: 'weak', text: 'Fraca', bars: 1 };
    if (score <= 3) return { level: 'medium', text: 'M?dia', bars: 2 };
    if (score <= 4) return { level: 'strong', text: 'Forte', bars: 3 };
    return { level: 'strong', text: 'Muito Forte', bars: 4 };
  },

  // ???? CSRF Token ????
  generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) meta.setAttribute('content', token);
    return token;
  },

  getCSRFToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  },

  // ???? Rate Limiter ????
  _rateLimits: {},
  isRateLimited(action, maxAttempts = 5, windowMs = 60000) {
    const now = Date.now();
    if (!this._rateLimits[action]) {
      this._rateLimits[action] = [];
    }
    // Clean old entries
    this._rateLimits[action] = this._rateLimits[action].filter(t => now - t < windowMs);
    if (this._rateLimits[action].length >= maxAttempts) {
      return true;
    }
    this._rateLimits[action].push(now);
    return false;
  },

  // ???? Sanitize form data object ????
  sanitizeFormData(data) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = typeof value === 'string' ? this.sanitizeHTML(value.trim()) : value;
    }
    return sanitized;
  }
};

// Generate CSRF token on page load
document.addEventListener('DOMContentLoaded', () => {
  Security.generateCSRFToken();
});

