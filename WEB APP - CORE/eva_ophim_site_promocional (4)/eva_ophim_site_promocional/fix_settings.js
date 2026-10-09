const fs = require('fs');
let content = fs.readFileSync('app/settings.html', 'utf8');

const saveProfileCode = `    async function saveProfile() {
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
    }`;

const avatarUploadCode = `    function handleAvatarUpload(event) {
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
    }`;

content = content.replace(/async function saveProfile\(\) \{[\s\S]*?\}\s*\}\s*\n/m, saveProfileCode + '\n\n');
content = content.replace(/function handleAvatarUpload\(event\) \{[\s\S]*?\}\s*\n/m, avatarUploadCode + '\n\n');

fs.writeFileSync('app/settings.html', content, 'utf8');
