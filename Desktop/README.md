# ASTHA RAVEN WMS — Aplicação Electron Independente (`electron/`)

Este diretório contém o aplicativo **Electron** estruturado no **padrão oficial da indústria** (`src/main`, `src/renderer` e `dados.json`), operando como um **programa independente** do Web App e unificado a ele pelo **mesmo banco de dados MySQL**.

## Estrutura de Pastas (Padrão Oficial da Indústria)

```text
📁 electron/
  📄 package.json          // Manifesto do Electron ("main": "src/main/index.js")
  📄 dados.json            // Nosso Banco de Dados JSON local sincronizado com o MySQL
  📁 src/
    📁 main/               // O Back-end (Node.js)
      📄 index.js          // A Cozinha (Processo Principal Electron + IPC + Bootstrap)
      📄 preload.js        // O Garçom (Ponte de Contexto Segura via contextBridge)
      📄 dados-store.js    // Persistência de dados.json + Sincronização com MySQL
      📄 server.js         // Servidor Express interno independente do Electron
      📄 api-bootstrap.js  // Seletor de perfil (local astha_raven_lab / COTIL cl205131)
      📁 database/         // Conexão MySQL e schemas próprios do Electron
      📁 routes/           // Rotas de domínio próprias do Electron
      📁 middleware/       // Autenticação JWT, RBAC e proteção HTTP
      📁 security/         // Perfis DPAPI, TLS e validações
      📁 services/         // Serviços (Analytics, MRP, EAM, Mapa 3D, Pessoal)
    📁 renderer/           // O Front-end (Interface/UI)
      📄 index.html        // Entrada da Interface do Cliente
      📄 renderer.js       // O Cliente (Comunicação com O Garçom via window.api)
      📄 login.html        // Páginas completas do ASTHA RAVEN WMS
      📄 home.html
      📄 sistema.html
      📄 personal.html
      📄 analytics.html
      📄 viewer-3d.html
      📁 css/              // Folhas de estilo próprias do Renderer
      📁 js/               // Scripts próprios do Renderer
      📁 images/           // Ícones e imagens próprios do Renderer
      📁 assets/           // Logos e recursos visuais
      📁 vendor/           // Motor CAD 3D (OCCT WASM)
```

## Como os dois programas funcionam juntos?

1. **Programas separados:** O Electron possui seu próprio Front-end (`src/renderer/`) e seu próprio Back-end (`src/main/`), rodando na porta `3001` por padrão para nunca conflitar com o Web App na porta `3000`.
2. **Unificados pelo Banco de Dados:** Tanto o Web App quanto o Electron conectam-se ao mesmo banco MySQL (`127.0.0.1:3306 / astha_raven_lab` no perfil local ou `143.106.241.4:3306 / cl205131` no perfil COTIL), sincronizando automaticamente as estatísticas e últimos registros com `electron/dados.json`.
