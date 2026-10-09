let selectedType = null;
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnNext1')?.addEventListener('click', continueFromType);
});

function selectType(type, element) {
  selectedType = type;
  document.querySelectorAll('.type-card').forEach(card => card.classList.toggle('selected', card === element));
  clearMessage();
}

function continueFromType() {
  if (!selectedType) { showToast('Selecione um tipo de conta para continuar.'); return; }
  nextStep(2);
}

function nextStep(stepNumber) {
  document.querySelectorAll('.wizard-step').forEach(step => { step.style.display = 'none'; });
  const next = document.getElementById(`step${stepNumber}`);
  if (next) next.style.display = 'block';
  const caption = document.querySelector('.register-art-caption');
  const captions = ['Cada item no seu lugar. Tudo conectado.', 'Seu perfil é o primeiro passo para organizar tudo.', 'Proteja sua conta para cuidar da sua operação.', 'Tudo pronto para começar a organizar.'];
  if (caption) caption.textContent = captions[stepNumber - 1] || captions[0];
  clearMessage();
}

function prevStep(stepNumber) { nextStep(stepNumber); }

function clearMessage() {
  const message = document.getElementById('toast');
  message.hidden = true;
  message.textContent = '';
}

function showToast(message) {
  const target = document.getElementById('toast');
  target.textContent = message;
  target.hidden = false;
  target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function continueToPassword() {
  const name = document.getElementById('regName');
  const email = document.getElementById('regEmail');
  if (!name.value.trim()) { showToast('Informe seu nome completo.'); name.focus(); return; }
  if (!email.validity.valid || !email.value.trim()) { showToast('Informe um e-mail válido.'); email.focus(); return; }
  nextStep(3);
}

function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.textContent = show ? 'Ocultar' : 'Mostrar';
  button.setAttribute('aria-pressed', String(show));
  button.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
}

async function finishRegistration() {
  const fullName = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPass').value;
  const confirmation = document.getElementById('regPassConfirm').value;
  if (!fullName || !email) { showToast('Complete seu nome e e-mail.'); return; }
  if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
    showToast('A senha deve ter de 8 a 72 bytes.');
    document.getElementById('regPass').focus(); return;
  }
  if (password !== confirmation) { showToast('As senhas não conferem.'); document.getElementById('regPassConfirm').focus(); return; }
  const nameParts = fullName.split(/\s+/);
  const name = nameParts.shift();
  const surname = nameParts.join(' ');
  const button = document.getElementById('createAccountButton');
  button.disabled = true;
  button.textContent = 'Criando conta…';
  try {
    const result = await API.post('/auth/register', {
      name, surname, email, password,
      dob: document.getElementById('regDob').value || null,
      gender: document.getElementById('regGender').value || null,
      country: document.getElementById('regCountry').value.trim() || null,
      phone: document.getElementById('regPhone').value.trim() || null
    });
    if (!result.success || !result.token || !result.user) {
      showToast(result.error || 'Não foi possível criar a conta. Tente novamente.');
      return;
    }
    localStorage.setItem('astha_token', result.token);
    localStorage.setItem('astha_user', JSON.stringify(result.user));
    sessionStorage.setItem('astha_onboarding_type', selectedType || 'corp');
    nextStep(4);
  } catch (_) {
    showToast('Não foi possível concluir o cadastro. Tente novamente.');
  } finally {
    button.disabled = false;
    button.textContent = 'Criar conta';
  }
}
