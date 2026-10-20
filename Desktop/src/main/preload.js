'use strict';

/* ============================================================
   src/main/preload.js — O GARÇOM (Ponte de Contexto Segura)
   Atua como intermediário seguro entre:
   - O Cliente (src/renderer/renderer.js - Front-end/UI)
   - A Cozinha (src/main/index.js - Back-end Node.js + Banco de Dados)
   ============================================================ */

const { contextBridge, ipcRenderer } = require('electron');

const garcomApi = Object.freeze({
  isDesktop: true,
  platform: process.platform,

  // Lê os dados de dados.json (sincronizados com o MySQL)
  lerDados() {
    return ipcRenderer.invoke('dados:ler');
  },

  // Salva preferências/registros em dados.json na Cozinha
  salvarDados(novosDados) {
    return ipcRenderer.invoke('dados:salvar', novosDados);
  },

  // Força uma sincronização em tempo real entre o MySQL compartilhado e dados.json
  sincronizarBanco(evento) {
    return ipcRenderer.invoke('dados:sincronizar', evento);
  },

  // Obtém informações do runtime Desktop (porta, perfil ativo, URL)
  getRuntimeInfo() {
    return ipcRenderer.invoke('astha:runtime-info');
  }
});

// Expõe para o Front-end (Renderer / O Cliente)
contextBridge.exposeInMainWorld('api', garcomApi);
contextBridge.exposeInMainWorld('asthaDesktop', garcomApi);
