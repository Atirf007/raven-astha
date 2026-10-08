/* ============================================================
   ASTAH RAVEN - WIZARD REGISTRATION LOGIC (SIMPLIFIED)
   ============================================================ */

let selectedType = null;

function selectType(type, element) {
  selectedType = type;
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  element.classList.add('selected');
  document.getElementById('btnNext1').style.display = 'block';
}

function nextStep(stepNumber) {
  // Hide all steps
  document.querySelectorAll('.wizard-step').forEach(el => {
    el.style.display = 'none';
  });

  // Show the requested step
  const next = document.getElementById('step' + stepNumber);
  if (next) {
    next.style.display = 'block';
  }
}

function prevStep(stepNumber) {
  nextStep(stepNumber);
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = isError ? 'error show' : 'show';
  setTimeout(() => t.className = '', 3000);
}

async function finishRegistration() {
  const n = document.getElementById('regName').value;
  const e = document.getElementById('regEmail').value;
  const p = document.getElementById('regPass').value;
  const pc = document.getElementById('regPassConfirm').value;
  
  const dob = document.getElementById('regDob')?.value;
  const gender = document.getElementById('regGender')?.value;
  const country = document.getElementById('regCountry')?.value;
  const phone = document.getElementById('regPhone')?.value;

  if (!n || !e || !p) {
    showToast("Preencha os campos obrigatórios.", true);
    return;
  }
  if (p !== pc) {
    showToast("As senhas não conferem.", true);
    return;
  }
  if (p.length < 6) {
    showToast("A senha deve ter no mínimo 6 caracteres.", true);
    return;
  }

  // Splitting name and surname
  const nameParts = n.trim().split(' ');
  const firstName = nameParts.shift();
  const lastName = nameParts.join(' ');

  try {
    const res = await API.post('/auth/register', {
      name: firstName,
      surname: lastName,
      email: e,
      password: p,
      dob: dob,
      gender: gender,
      country: country,
      phone: phone
    });

    if (res.success || res.message) {
      // Now login automatically
      const loginRes = await API.post('/auth/login', { email: e, password: p });
      if (loginRes.success && loginRes.token) {
        localStorage.setItem('astah_token', loginRes.token);
        if (loginRes.user) {
          // Store country in user object for local usage if needed (even though settings.html handles it)
          if(country) loginRes.user.country = country;
          localStorage.setItem('astah_user', JSON.stringify(loginRes.user));
        }
      }
      nextStep(4);
    } else {
      showToast(res.error || 'Erro ao registrar.', true);
    }
  } catch (err) {
    showToast('Erro de conexão: ' + err.message, true);
  }
}
