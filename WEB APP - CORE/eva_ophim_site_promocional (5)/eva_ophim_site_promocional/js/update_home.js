const fs = require('fs');

const htmlFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/home/index.html';
let content = fs.readFileSync(htmlFile, 'utf8');

// 1. Add Image Compression helper to scripts
const scriptsStart = content.indexOf('<script>');
const compressImgHelper = `<script>
    function compressImage(file, maxSize, callback) {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if(w > maxSize || h > maxSize) {
             const ratio = Math.min(maxSize/w, maxSize/h);
             w = w * ratio; h = h * ratio;
          }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          callback(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
`;
content = content.replace('<script>', compressImgHelper);

// 2. Update previewProfileImage and previewCorpLogo to use compression
content = content.replace(
  /function previewProfileImage\(input\) \{[\s\S]*?reader\.readAsDataURL\(file\);\s*\}/,
  `function previewProfileImage(input) {
      const file = input.files[0];
      if(!file) return;
      compressImage(file, 256, (dataUrl) => {
        document.getElementById('profImagePreview').src = dataUrl;
        document.getElementById('profImagePreview').style.display = 'block';
        document.getElementById('profImagePlaceholder').style.display = 'none';
        document.getElementById('profImageData').value = dataUrl;
      });
    }`
);

content = content.replace(
  /function previewCorpLogo\(input\) \{[\s\S]*?reader\.readAsDataURL\(file\);\s*\}/,
  `function previewCorpLogo(input) {
      const file = input.files[0];
      if(!file) return;
      compressImage(file, 400, (dataUrl) => {
        document.getElementById('corpLogoPreview').src = dataUrl;
        document.getElementById('corpLogoPreview').style.display = 'block';
        document.getElementById('corpLogoPlaceholder').style.display = 'none';
        document.getElementById('corpLogoData').value = dataUrl;
      });
    }`
);

// 3. Add newOrgModal HTML just before adminModal
const adminModalStart = content.indexOf('<!-- Modal Admin Center');
const newOrgModalHtml = `
  <!-- Modal Nova Organização -->
  <div class="eo-modal-overlay" id="newOrgModal" style="padding: var(--space-4);">
    <div class="eo-modal" style="max-width: 500px; max-height: 90vh; overflow-y: auto;">
      <div class="eo-modal-header">
        <h3 class="eo-modal-title">Nova Organização</h3>
        <button class="eo-modal-close" onclick="closeModal('newOrgModal')">✕</button>
      </div>
      <div>
         <div class="input-group">
           <label class="eo-input-label">Nome da Corporação</label>
           <input type="text" class="eo-input" id="newOrgName" placeholder="Ex: Evah Ophim Ltda.">
         </div>
         <div class="input-group">
           <label class="eo-input-label">Plano de Assinatura Inicial</label>
           <select class="eo-input" id="newOrgPlan">
             <option value="Free">Free</option>
             <option value="Professional">Professional</option>
             <option value="Enterprise">Enterprise</option>
             <option value="Personalized">Personalized</option>
           </select>
         </div>
         <div style="margin-top:var(--space-6); text-align:right;">
           <button class="btn btn-primary" onclick="submitNewOrg()">Criar Locatário</button>
         </div>
      </div>
    </div>
  </div>

  `;
content = content.slice(0, adminModalStart) + newOrgModalHtml + content.slice(adminModalStart);

// 4. Update createNewOrg to open modal instead of prompt, and add submitNewOrg
content = content.replace(
  /function createNewOrg\(\) \{[\s\S]*?\}\s*function openAdminModal\(\) \{/,
  `function createNewOrg() {
      document.getElementById('newOrgName').value = '';
      document.getElementById('newOrgPlan').value = 'Free';
      document.getElementById('newOrgModal').classList.add('active');
    }
    
    function submitNewOrg() {
      const name = document.getElementById('newOrgName').value.trim();
      if(!name) { showToast('Preencha o nome', 'warning'); return; }
      
      const newOrg = {
         id: 'org_' + Date.now(),
         name: name,
         plan: document.getElementById('newOrgPlan').value,
         logo: null,
         policies: { allowEdit: true, require2FA: false, restrictIP: false, advancedAudit: false }
      };
      organizations.push(newOrg);
      currentOrgId = newOrg.id;
      
      try {
         localStorage.setItem('evah_orgs', JSON.stringify(organizations));
         showToast('Organização criada com sucesso!', 'success');
      } catch(e) {
         showToast('Erro ao salvar organização.', 'error');
      }
      
      closeModal('newOrgModal');
      
      // Refresh admin modal
      const sel = document.getElementById('orgSelector');
      if(sel) {
         sel.innerHTML = organizations.map(o => \`<option value="\${o.id}" \${o.id===currentOrgId?'selected':''}>\${o.name}</option>\`).join('');
         loadOrgSettings();
      }
    }

    function openAdminModal() {`
);

// 5. Add "Logs de Acesso" Tab to Admin Center
const adminTabsHtmlOld = `<button class="btn btn-ghost btn-sm admin-tab-btn" onclick="switchAdminTab(2)">⚙️ Políticas Avançadas</button>`;
const adminTabsHtmlNew = `<button class="btn btn-ghost btn-sm admin-tab-btn" onclick="switchAdminTab(2)">⚙️ Políticas Avançadas</button>
         <button class="btn btn-ghost btn-sm admin-tab-btn" id="tabLogsBtn" onclick="switchAdminTab(3)" style="display:none; color: var(--color-warning);">🔒 Logs (Suporte TI)</button>`;
content = content.replace(adminTabsHtmlOld, adminTabsHtmlNew);

const adminTab2End = `</div>
    </div>
  </div>`;
// Replace the end of adminModal with the new Tab 3
const adminTab3Html = `
      <!-- Aba Logs de Acesso (TI) -->
      <div id="adminTab3" class="admin-tab" style="display:none;">
         <label class="eo-input-label">Logs de Acesso e Segurança (Nível de TI)</label>
         <p style="font-size:var(--text-xs); color:var(--text-secondary); margin-bottom: 15px;">Registro imutável de eventos críticos da organização selecionada.</p>
         
         <div style="background:var(--bg-elevated); border:1px solid var(--surface-border); border-radius:var(--radius-lg); padding:var(--space-4); max-height:300px; overflow-y:auto; font-family: var(--font-mono); font-size: 11px;">
           <div style="color:var(--color-success); margin-bottom: 5px;">[${new Date().toISOString()}] ACCESS_GRANTED - root@evah.local (IP: 127.0.0.1)</div>
           <div style="color:var(--text-secondary); margin-bottom: 5px;">[${new Date(Date.now() - 3600000).toISOString()}] POLICY_UPDATE - allowEdit = true</div>
           <div style="color:var(--color-error); margin-bottom: 5px;">[${new Date(Date.now() - 86400000).toISOString()}] FAILED_LOGIN - attempt from IP: 45.33.22.11</div>
           <div style="color:var(--text-secondary); margin-bottom: 5px;">[${new Date(Date.now() - 186400000).toISOString()}] USER_CREATED - ana@evah.com by root</div>
         </div>
      </div>
    </div>
  </div>`;
content = content.replace(adminTab2End, adminTab3Html);

// 6. Conditionally show Logs Tab
content = content.replace(
  /function openAdminModal\(\) \{[\s\S]*?switchAdminTab\(0\);/,
  `function openAdminModal() {
      const sel = document.getElementById('orgSelector');
      sel.innerHTML = organizations.map(o => \`<option value="\${o.id}" \${o.id===currentOrgId?'selected':''}>\${o.name}</option>\`).join('');
      
      // Check if user is IT Support to show logs tab
      if(currentUser.sector === 'TI' || currentUser.email === 'root@evah.local') {
         document.getElementById('tabLogsBtn').style.display = 'inline-block';
      } else {
         document.getElementById('tabLogsBtn').style.display = 'none';
      }
      
      loadOrgSettings();
      renderAdminUserList();
      switchAdminTab(0);`
);

fs.writeFileSync(htmlFile, content);
