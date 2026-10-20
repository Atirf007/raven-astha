'use strict';

/* ============================================================
   src/renderer/renderer.js — O CLIENTE (Front-end / Interface UI)
   Conversa com O Garçom (src/main/preload.js via window.api)
   para buscar e sincronizar dados com A Cozinha (src/main/index.js),
   mantendo dados.json e o banco MySQL compartilhado em sincronia.
   ============================================================ */

(function initAsthaElectronRenderer() {
  async function obterDadosDaCozinha() {
    if (window.api && typeof window.api.lerDados === 'function') {
      try {
        return await window.api.lerDados();
      } catch (_) {}
    }
    try {
      const res = await fetch('/api/desktop/dados');
      if (res.ok) return await res.json();
    } catch (_) {}
    return null;
  }

  async function sincronizarComCozinha(motivo) {
    if (window.api && typeof window.api.sincronizarBanco === 'function') {
      try {
        return await window.api.sincronizarBanco(motivo);
      } catch (_) {}
    }
    try {
      const res = await fetch('/api/desktop/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: motivo || 'Sincronização pelo Cliente (Renderer)' })
      });
      if (res.ok) return await res.json();
    } catch (_) {}
    return null;
  }

  function atualizarPainelEntrada(dados) {
    const statusEl = document.getElementById('desktop-db-status');
    const perfilEl = document.getElementById('desktop-db-profile');
    const contadoresEl = document.getElementById('desktop-db-counters');
    if (!statusEl || !dados) return;

    const conexao = dados.conexaoBanco || {};
    const stats = dados.estatisticasSincronizadas || {};
    const conectado = conexao.status === 'conectado_sincronizado';

    statusEl.textContent = conectado
      ? `MySQL Compartilhado Conectado (${conexao.database || 'astha_raven_lab'}) + dados.json Sincronizado`
      : 'Modo Local (dados.json ativo)';
    statusEl.dataset.state = conectado ? 'online' : 'offline';

    if (perfilEl) {
      perfilEl.textContent = `Perfil: ${conexao.perfilAtivo || 'local'} | Host: ${conexao.host || '127.0.0.1'}:${conexao.porta || 3306}`;
    }

    if (contadoresEl) {
      contadoresEl.textContent =
        `Materiais: ${stats.materiais ?? 0} • Movimentações: ${stats.movimentacoes ?? 0} • Ativos EAM: ${stats.ativosEam ?? 0} • Usuários: ${stats.usuarios ?? 0}`;
    }
  }

  window.AsthaRendererCliente = Object.freeze({
    obterDadosDaCozinha,
    sincronizarComCozinha,
    atualizarPainelEntrada
  });

  document.addEventListener('DOMContentLoaded', async () => {
    const dados = await obterDadosDaCozinha();
    atualizarPainelEntrada(dados);

    const btnSync = document.getElementById('btn-sync-dados');
    if (btnSync) {
      btnSync.addEventListener('click', async () => {
        btnSync.disabled = true;
        const atualizado = await sincronizarComCozinha('Sincronização manual solicitada pelo Cliente');
        atualizarPainelEntrada(atualizado);
        btnSync.disabled = false;
      });
    }
  });
})();
