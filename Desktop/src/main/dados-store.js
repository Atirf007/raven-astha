'use strict';

/* ============================================================
   ASTHA RAVEN DESKTOP — Gerenciador do dados.json (A Cozinha)
   Persiste dados localmente em electron/dados.json e sincroniza
   em tempo real com o banco de dados MySQL compartilhado com o Web App.
   ============================================================ */

const fs = require('node:fs');
const path = require('node:path');

const DADOS_PATH = path.resolve(__dirname, '..', '..', 'dados.json');

function criarEstruturaPadrao() {
  return {
    sistema: {
      nome: 'ASTHA RAVEN WMS — Edição Desktop (Electron)',
      versao: '1.0.0',
      arquitetura: {
        padrao: 'Oficial da Indústria para Electron (Main / Preload / Renderer / Dados)',
        cozinha: 'src/main/index.js (Back-end Node.js + Processo Principal Electron)',
        garcom: 'src/main/preload.js (Ponte de Contexto Segura via contextBridge)',
        cliente: 'src/renderer/renderer.js + src/renderer/index.html (Front-end / Interface UI)',
        bancoLocal: 'dados.json (Persistência JSON local sincronizada com o MySQL)'
      },
      integracaoEcossistema: 'Aplicação Desktop independente que compartilha o mesmo banco de dados MySQL com o Web App, unificando ambos em tempo real.'
    },
    conexaoBanco: {
      perfilAtivo: 'local',
      host: '127.0.0.1',
      porta: 3306,
      database: 'astha_raven_lab',
      status: 'aguardando_inicializacao',
      ultimaSincronizacao: null
    },
    estatisticasSincronizadas: {
      organizacoes: 0,
      usuarios: 0,
      materiais: 0,
      movimentacoes: 0,
      ativosEam: 0,
      espacosPessoais: 0
    },
    ultimosMateriais: [],
    preferenciasDesktop: {
      tema: 'dark-industrial',
      mostrarIndicadorSincronizacao: true,
      sincronizacaoAutomatica: true
    },
    registrosLocais: []
  };
}

function lerDados() {
  try {
    if (!fs.existsSync(DADOS_PATH)) {
      const inicial = criarEstruturaPadrao();
      fs.writeFileSync(DADOS_PATH, JSON.stringify(inicial, null, 2), 'utf8');
      return inicial;
    }
    const bruto = fs.readFileSync(DADOS_PATH, 'utf8');
    const parsed = JSON.parse(bruto);
    return { ...criarEstruturaPadrao(), ...parsed };
  } catch (_) {
    return criarEstruturaPadrao();
  }
}

function salvarDados(novosDados = {}) {
  const atual = lerDados();
  const atualizado = {
    ...atual,
    ...novosDados,
    conexaoBanco: {
      ...atual.conexaoBanco,
      ...(novosDados.conexaoBanco || {})
    },
    estatisticasSincronizadas: {
      ...atual.estatisticasSincronizadas,
      ...(novosDados.estatisticasSincronizadas || {})
    },
    preferenciasDesktop: {
      ...atual.preferenciasDesktop,
      ...(novosDados.preferenciasDesktop || {})
    }
  };
  fs.writeFileSync(DADOS_PATH, JSON.stringify(atualizado, null, 2), 'utf8');
  return atualizado;
}

function registrarEventoLocal(titulo, origem = 'electron-desktop') {
  const atual = lerDados();
  const lista = Array.isArray(atual.registrosLocais) ? atual.registrosLocais.slice(0, 49) : [];
  lista.unshift({
    id: 'evt-' + Date.now(),
    titulo: String(titulo || 'Evento Desktop').slice(0, 160),
    origem: String(origem || 'electron-desktop').slice(0, 60),
    criadoEm: new Date().toISOString()
  });
  return salvarDados({ registrosLocais: lista });
}

async function contarTabelaSegura(pool, sql) {
  try {
    const [rows] = await pool.query(sql);
    return Number(rows?.[0]?.total || 0);
  } catch (_) {
    return 0;
  }
}

async function sincronizarComMySQL(pool, meta = {}) {
  const estado = lerDados();
  const host = meta.host || process.env.DB_HOST || estado.conexaoBanco.host || '127.0.0.1';
  const porta = Number(meta.port || process.env.DB_PORT || estado.conexaoBanco.porta || 3306);
  const database = meta.database || process.env.DB_NAME || estado.conexaoBanco.database || 'astha_raven_lab';
  const perfilAtivo = meta.profile || process.env.ASTHA_ACTIVE_WEB_PROFILE || estado.conexaoBanco.perfilAtivo || 'local';

  try {
    const [organizacoes, usuarios, materiais, movimentacoes, ativosEam, espacosPessoais] = await Promise.all([
      contarTabelaSegura(pool, 'SELECT COUNT(*) AS total FROM organizations'),
      contarTabelaSegura(pool, 'SELECT COUNT(*) AS total FROM users'),
      contarTabelaSegura(pool, 'SELECT COUNT(*) AS total FROM materials'),
      contarTabelaSegura(pool, 'SELECT COUNT(*) AS total FROM stock_movements'),
      contarTabelaSegura(pool, 'SELECT COUNT(*) AS total FROM eam_assets'),
      contarTabelaSegura(pool, 'SELECT COUNT(*) AS total FROM personal_spaces')
    ]);

    let ultimosMateriais = [];
    try {
      const [rows] = await pool.query(
        'SELECT id, code, name, category, quantity, unit FROM materials ORDER BY id DESC LIMIT 10'
      );
      ultimosMateriais = (rows || []).map(r => ({
        id: r.id,
        codigo: r.code,
        nome: r.name,
        categoria: r.category,
        quantidade: Number(r.quantity || 0),
        unidade: r.unit
      }));
    } catch (_) {}

    return salvarDados({
      conexaoBanco: {
        perfilAtivo,
        host,
        porta,
        database,
        status: 'conectado_sincronizado',
        ultimaSincronizacao: new Date().toISOString()
      },
      estatisticasSincronizadas: {
        organizacoes,
        usuarios,
        materiais,
        movimentacoes,
        ativosEam,
        espacosPessoais
      },
      ultimosMateriais
    });
  } catch (_) {
    return salvarDados({
      conexaoBanco: {
        perfilAtivo,
        host,
        porta,
        database,
        status: 'modo_offline_json',
        ultimaSincronizacao: new Date().toISOString()
      }
    });
  }
}

module.exports = {
  DADOS_PATH,
  lerDados,
  salvarDados,
  registrarEventoLocal,
  sincronizarComMySQL
};
