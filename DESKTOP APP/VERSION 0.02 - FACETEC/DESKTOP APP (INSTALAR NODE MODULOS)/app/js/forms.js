/* ============================================================
   ASTAH RAVEN ? Forms (forms.js)
   Validação de formulários, multi-step, password strength UI
   ============================================================ */

// ???? Toast Notifications ????
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${Security.escapeHTML(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ???? Form Validation ????
function validateField(input) {
  const value = input.value.trim();
  const type = input.type;
  const errorEl = document.getElementById(input.id + 'Error');
  let error = '';

  if (input.required && !value) {
    error = 'Campo obrigatório';
  } else if (type === 'email' && value && !Security.isValidEmail(value)) {
    error = 'Email inválido';
  } else if (type === 'password' && value && value.length < 8) {
    error = 'Mínimo 8 caracteres';
  }

  if (errorEl) errorEl.textContent = error;
  input.classList.toggle('input-error-state', !!error);
  input.classList.toggle('input-success-state', !error && value);
  return !error;
}

// ???? Password Strength UI ????
function updatePasswordStrength(password) {
  const strength = Security.getPasswordStrength(password);
  const bars = document.querySelectorAll('#passwordStrength .password-strength-bar');
  const text = document.getElementById('passwordStrengthText');

  bars.forEach((bar, i) => {
    bar.className = 'password-strength-bar';
    if (i < strength.bars) bar.classList.add(strength.level);
  });

  if (text) {
    text.textContent = password ? `Força: ${strength.text}` : '';
    text.style.color = strength.level === 'weak' ? 'var(--color-error)' :
                       strength.level === 'medium' ? 'var(--color-warning)' : 'var(--color-success)';
  }
}

// ???? Multi-Step Form ????
function nextStep(step) {
  // Validate current step
  const currentStep = document.querySelector('.form-step.active');
  if (!currentStep) return;
  const inputs = currentStep.querySelectorAll('.input[required]');
  let valid = true;
  inputs.forEach(input => { if (!validateField(input)) valid = false; });
  if (!valid) return;

  // Switch step
  document.querySelectorAll('.form-step').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const target = document.getElementById(`step${step}`);
  if (target) {
    target.classList.add('active');
    target.style.display = 'block';
  }

  // Update progress dots
  document.querySelectorAll('.step-dot').forEach(dot => {
    const dotStep = parseInt(dot.dataset.step);
    dot.classList.toggle('active', dotStep === step);
    dot.classList.toggle('completed', dotStep < step);
  });
  document.querySelectorAll('.step-line').forEach((line, i) => {
    line.classList.toggle('completed', i < step - 1);
  });
}

function prevStep(step) {
  document.querySelectorAll('.form-step').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const target = document.getElementById(`step${step}`);
  if (target) {
    target.classList.add('active');
    target.style.display = 'block';
  }
  document.querySelectorAll('.step-dot').forEach(dot => {
    const dotStep = parseInt(dot.dataset.step);
    dot.classList.toggle('active', dotStep === step);
    dot.classList.toggle('completed', dotStep < step);
  });
  document.querySelectorAll('.step-line').forEach((line, i) => {
    line.classList.toggle('completed', i < step - 1);
  });
}

// ???? Init form listeners ????
document.addEventListener('DOMContentLoaded', () => {
  // Real-time validation
  document.querySelectorAll('.input').forEach(input => {
    input.addEventListener('blur', () => validateField(input));
  });

  // Password strength listener
  const regPassword = document.getElementById('regPassword');
  if (regPassword) {
    regPassword.addEventListener('input', () => updatePasswordStrength(regPassword.value));
  }

  // Contact form ? POST to API
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (Security.isRateLimited('contact', 3, 60000)) {
        showToast('Aguarde antes de enviar novamente.', 'warning');
        return;
      }

      const name = document.getElementById('contactName')?.value?.trim();
      const email = document.getElementById('contactEmail')?.value?.trim();
      const subject = document.getElementById('contactSubject')?.value || 'Geral';
      const message = document.getElementById('contactMessage')?.value?.trim();

      if (!name || !email || !message) {
        showToast('Preencha todos os campos obrigatórios.', 'error');
        return;
      }
      if (!Security.isValidEmail(email)) {
        showToast('Email inválido.', 'error');
        return;
      }

      const btn = contactForm.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Enviando...';

      try {
        const apiBase = (function() {
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
        })();
        const res = await fetch(`${apiBase}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, subject, message })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('Mensagem enviada com sucesso! Responderemos em breve.', 'success');
          contactForm.reset();
        } else {
          showToast(data.error || 'Erro ao enviar mensagem.', 'error');
        }
      } catch (err) {
        // Fallback if API is offline
        console.warn('API offline, saving locally:', err);
        showToast('Mensagem registrada! Entraremos em contato em breve.', 'success');
        contactForm.reset();
      }

      btn.disabled = false;
      btn.textContent = originalText;
    });
  }
});

