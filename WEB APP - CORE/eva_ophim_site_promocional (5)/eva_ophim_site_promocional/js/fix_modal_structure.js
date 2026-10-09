const fs = require('fs');

const htmlFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/home/index.html';
let content = fs.readFileSync(htmlFile, 'utf8');

// The structural issue: adminTab3 is inside newOrgModal.
// We need to move it out of newOrgModal and into adminModal.

// 1. Find the exact block of adminTab3
const adminTab3Regex = /<!-- Aba Logs de Acesso \(TI\) -->[\s\S]*?<div id="adminTab3" class="admin-tab" style="display:none;">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const match = content.match(adminTab3Regex);
if(match) {
  let adminTab3Block = match[0];
  
  // We need to carefully extract adminTab3 WITHOUT the extra closing tags of newOrgModal
  // Wait, the match includes the closing tags. Let's rebuild adminTab3
  const newAdminTab3 = `
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
`;
  
  // Replace the old block (which contained the closing tags of newOrgModal) with JUST the closing tags of newOrgModal
  content = content.replace(match[0], `      </div>\n    </div>\n  </div>`);
  
  // Now, insert the proper adminTab3 into adminModal.
  // The adminModal ends with:
  //       </div>
  //     </div>
  //   </div>
  // We need to place adminTab3 just before the closing </div></div></div> of adminModal.
  
  // Let's find the end of adminTab2:
  const adminTab2EndMatch = /<button class="btn btn-primary btn-sm" onclick="saveOrgSettings\(\)">Salvar Políticas<\/button>\s*<\/div>\s*<\/div>/;
  
  if(adminTab2EndMatch.test(content)) {
    content = content.replace(adminTab2EndMatch, (str) => str + "\n" + newAdminTab3);
    fs.writeFileSync(htmlFile, content);
    console.log("Moved adminTab3 to adminModal");
  } else {
    console.log("Could not find end of adminTab2");
  }
} else {
  console.log("Could not find adminTab3 block");
}
