const fs = require('fs');
let content = fs.readFileSync('app/js/sistema-core.js', 'utf8');

const svgs = {
  qr: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>',
  info: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
  edit: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>',
  map: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
  compare: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>',
  del: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>'
};

// Replace buttons
const actionsHtml = `        <td><div class="eo-actions">
          <button class="eo-action-btn" title="QR Code" onclick="showQRCode('\\$\\{m.code\\}', '\\$\\{m.desc.replace(/'/g, "\\\\'")\\}')">${svgs.qr}</button>
          <button class="eo-action-btn" title="Mais Info" onclick="openMoreInfo('\\$\\{m.code\\}')">${svgs.info}</button>
          <button class="eo-action-btn" title="Editar" onclick="openEditMaterial('\\$\\{m.code\\}')" \\$\\{canEdit?'':'disabled'\\}>${svgs.edit}</button>
          <button class="eo-action-btn" title="Ver no Mapa" onclick="locateOnMap('\\$\\{m.code\\}')">${svgs.map}</button>
          <button class="eo-action-btn" title="Comparar" onclick="comparePricesFor('\\$\\{m.code\\}')">${svgs.compare}</button>
          <button class="eo-action-btn danger" title="Excluir" onclick="deleteMaterial('\\$\\{m.code\\}')" \\$\\{canDel?'':'disabled'\\}>${svgs.del}</button>
        </div></td></tr>\`}).join('');`.replace(/\\\$/g, '$').replace(/\\\{/g, '{').replace(/\\\}/g, '}');

content = content.replace(/<td><div class="eo-actions">[\s\S]*?<\/div><\/td><\/tr>`}\)\.join\(''\);/g, actionsHtml);

const modalHtml = `window.showQRCode = function(code, desc) {
      const modalHtml = \`
        <div id="qrModalOverlay" class="eo-modal-overlay active" style="z-index:9999;">
          <div class="eo-modal" style="max-width:320px; padding: 24px;">
            <div class="eo-modal-header" style="border-bottom:none; margin-bottom: 0;">
              <h3 class="eo-modal-title" style="font-size:18px;">\$\\{code\\}</h3>
              <button class="eo-modal-close" onclick="document.getElementById('qrModalOverlay').remove()">&times;</button>
            </div>
            <p style="font-size:13px; color:var(--text-tertiary); margin-bottom:16px; text-align:center;">\$\\{desc\\}</p>
            <div style="background:#fff; padding:12px; border-radius:12px; display:inline-block; margin:0 auto; width: 100%; text-align:center; box-sizing:border-box;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=\$\\{encodeURIComponent(code)\\}" alt="QR Code" style="width:100%; max-width:250px; display:block; margin:0 auto;">
            </div>
            <button class="eo-btn primary" style="margin-top:24px; width:100%; justify-content:center;" onclick="document.getElementById('qrModalOverlay').remove()">Fechar</button>
          </div>
        </div>
      \`;
      const old = document.getElementById('qrModalOverlay');
      if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
  };`.replace(/\\\$/g, '$').replace(/\\\{/g, '{').replace(/\\\}/g, '}');

content = content.replace(/window\.showQRCode = function\(code, desc\) {[\s\S]*?};\n/g, modalHtml + '\n');

fs.writeFileSync('app/js/sistema-core.js', content, 'utf8');
