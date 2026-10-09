const fs = require('fs');
let text = fs.readFileSync('app/settings.html', 'utf8');
const scriptStart = text.indexOf('<script>');
const scriptEnd = text.indexOf('</script>', scriptStart + 1) + 9;

const newScript = `<script>
    document.addEventListener('DOMContentLoaded', () => {
      loadUserData();
    });

    function loadUserData() {
      try {
        const userStr = localStorage.getItem('astha_user');
        if (userStr) {
          const u = JSON.parse(userStr);
          
          document.getElementById('profBigName').textContent = u.name || 'Usuário';
          document.getElementById('profBigEmail').textContent = u.email || '';
          
          const profAvatar = document.getElementById('profBigAvatar');
          if(u.avatar_url) {
            profAvatar.textContent = '';
            profAvatar.style.backgroundImage = "url('" + u.avatar_url + "')";
            profAvatar.style.backgroundSize = 'cover';
          } else if(u.name) {
            profAvatar.textContent = u.name.charAt(0).toUpperCase();
            profAvatar.style.backgroundImage = 'none';
          }
          
          document.getElementById('valName').textContent = u.name || 'Não informado';
          document.getElementById('inpName').value = u.name || '';
          document.getElementById('valEmail').textContent = u.email || 'Não informado';
          document.getElementById('inpEmail').value = u.email || '';
          
          document.getElementById('valDob').textContent = u.dob ? new Date(u.dob).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Não informado';
          document.getElementById('inpDob').value = u.dob || '';
          
          document.getElementById('valGender').textContent = u.gender || 'Não informado';
          document.getElementById('inpGender').value = u.gender || '';
          
          document.getElementById('valCountry').textContent = u.country || 'Não informado';
          document.getElementById('inpCountry').value = u.country || '';
          
          document.getElementById('valPhone').textContent = u.phone || 'Não informado';
          document.getElementById('inpPhone').value = u.phone || '';
          
          const roleMap = { 'superadmin': 'Superadmin', 'admin': 'Admin', 'manager': 'Gerente', 'operator': 'Operador', 'viewer': 'Visualizador' };
          document.getElementById('valRole').textContent = roleMap[u.role] || u.role;
          if(u.role !== 'admin' && u.role !== 'superadmin') {
            document.getElementById('valRole').classList.remove('admin');
            if(u.role === 'viewer') {
              document.getElementById('hasWorkspace').style.display = 'none';
              document.getElementById('noWorkspace').style.display = 'block';
            }
          }

          document.getElementById('listName1').textContent = u.name;
          document.getElementById('listEmail1').textContent = u.email;
          const listAv = document.getElementById('listAv1');
          if(u.name && !u.avatar_url) {
            listAv.textContent = u.name.charAt(0).toUpperCase();
            listAv.style.backgroundImage = 'none';
          } else if (u.avatar_url) {
            listAv.textContent = '';
            listAv.style.backgroundImage = "url('" + u.avatar_url + "')";
            listAv.style.backgroundSize = 'cover';
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    function switchTab(tabId, el) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.getElementById('tab-' + tabId).classList.add('active');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
      const titles = { 'profile': 'Perfil', 'workspace': 'Workspace', 'members': 'Membros', 'security': 'Segurança' };
      document.getElementById('currentBreadcrumb').textContent = titles[tabId];
    }

    let isEditMode = false;
    function toggleEditMode(formId) {
      isEditMode = !isEditMode;
      const form = document.getElementById(formId);
      
      const fields = ['Name', 'Email', 'Dob', 'Gender', 'Country', 'Phone'];
      fields.forEach(f => {
         const valEl = form.querySelector('#val' + f);
         const inpEl = form.querySelector('#inp' + f);
         if(valEl && inpEl) {
           valEl.style.display = isEditMode ? 'none' : 'block';
           inpEl.style.display = isEditMode ? 'block' : 'none';
         }
      });
      
      form.querySelector('#profileSaveRow').style.display = isEditMode ? 'flex' : 'none';
    }

    async function saveProfile() {
      const btn = document.querySelector('#profileSaveRow .btn-save');
      const originalText = btn.textContent;
      btn.textContent = 'Salvando...';
      try {
        const userStr = localStorage.getItem('astha_user');
        if(userStr) {
           const u = JSON.parse(userStr);
           u.name = document.getElementById('inpName').value;
           u.email = document.getElementById('inpEmail').value;
           u.dob = document.getElementById('inpDob').value;
           u.gender = document.getElementById('inpGender').value;
           u.country = document.getElementById('inpCountry').value;
           u.phone = document.getElementById('inpPhone').value;
           
           const res = await API.put('/auth/profile', u);
           if (res.success || res.message) {
               localStorage.setItem('astha_user', JSON.stringify(u));
               loadUserData();
               toggleEditMode('profileForm');
               showToast('Perfil atualizado com sucesso!');
           } else {
               showToast('Erro na API: ' + (res.error || 'Desconhecido'), true);
           }
        }
      } catch(e) {
        showToast('Erro ao salvar: ' + e.message, true);
      } finally {
        btn.textContent = originalText;
      }
    }

    function handleAvatarUpload(event) {
      const file = event.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = async function(e) {
        const dataUrl = e.target.result;
        const userStr = localStorage.getItem('astha_user');
        if(userStr) {
           const u = JSON.parse(userStr);
           u.avatar_url = dataUrl;
           try {
             const res = await API.put('/auth/profile', u);
             if (res.success || res.message) {
                 localStorage.setItem('astha_user', JSON.stringify(u));
                 loadUserData();
                 showToast('Foto de perfil atualizada!');
             } else {
                 showToast('Erro ao atualizar foto', true);
             }
           } catch(err) {
             showToast('Erro de conexão ao enviar foto', true);
           }
        }
      };
      reader.readAsDataURL(file);
    }

    function showToast(msg, isError = false) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = isError ? 'error show' : 'show';
      setTimeout(() => t.className = '', 3000);
    }

    function showConfirm() { document.getElementById('confirmModal').style.display = 'flex'; }
    function closeConfirm() { document.getElementById('confirmModal').style.display = 'none'; }
    function executeLogout() {
      localStorage.removeItem('astha_token');
      localStorage.removeItem('astha_user');
      window.location.href = './login.html';
    }

    function showDeleteConfirm() { document.getElementById('deleteModal').style.display = 'flex'; }
    function executeDeleteAccount() {
      showToast('Conta excluída com sucesso.', true);
      setTimeout(() => { executeLogout(); }, 1500);
    }
  </script>`;

text = text.substring(0, scriptStart) + newScript + text.substring(scriptEnd);
fs.writeFileSync('app/settings.html', text, 'utf8');
