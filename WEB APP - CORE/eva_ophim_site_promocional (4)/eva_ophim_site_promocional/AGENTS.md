# AGENTS.md

Instruções para agentes de IA. Mantenha este arquivo curto; documentação detalhada em `DOCUMENTACAO.md`.

## Sobre o projeto
- Nome: ASTHA RAVEN WMS; nomes legados EVAH OPHIM/ASTAH permanecem nos arquivos.
- Stack: HTML/CSS/JavaScript, Electron 30, Express 4, MySQL (`mysql2`), JWT e Three.js.
- Entrypoints: `main.js` (desktop), `api/server.js` (HTTP), `index.html` (redirecionamento).
- Código principal: `app/` (frontend atual) e `api/`; `evah/`, `js/`, `css/` e `old/` contêm versões paralelas/legadas.
- Testes: scripts avulsos `test-static.js`, `test-login.js` e `js/test_dom.js`; sem suíte configurada.

## Segurança obrigatória
- Edições em limites de confiança consultam `secure-coding`; queries usam `sql-injection-prevention`.
- Config/credenciais usam `secrets-hygiene`; dependências usam `dependency-supply-chain`.
- Revisões e autocheck de código sensível usam `code-review`, incluindo segurança.

## Regras de execução
1. Busque com `rg` antes de abrir arquivos; exclua `node_modules`, `.git`, `dist` e artefatos gerados.
2. Prefira edições cirúrgicas; não replique alterações em cópias legadas sem verificar quem as carrega.
3. Referencie caminho e linha; não repita código já apresentado.
4. Ajuste o esforço à tarefa e verifique lacunas do escopo com `finish-partial-work` quando concluir funções parciais.
5. Use apenas ferramentas/MCP necessários à tarefa.
6. Responda de forma concisa, salvo pedidos de documentação ou explicação detalhada.
7. Ao concluir tarefas grandes, registre pendências antes de sugerir uma nova sessão; não descarte contexto de trabalho incompleto.
8. Não exponha `api/.env`. `api/migrate.js` e `api/database/init.js` apagam tabelas: não execute contra bancos existentes sem autorização específica.

## Convenções e comandos
- Backend CommonJS; frontend usa scripts globais e manipulação direta do DOM.
- Linter/formatter e padrão de commits: não definidos nos arquivos examinados.
- API: `cd api` e `npm start`; execute a partir de `api/` para carregar o ambiente correto.
- Desktop: `npm start` na raiz. Build Windows: `npm run build` na raiz.
- Testes: não há `npm test`; os scripts HTTP exigem API local e não são uma suíte com asserções.

## Onde procurar
- Schema/modelos: `database/schema.sql`, `api/database/migrate_*.js` e SQL nas rotas.
- Rotas: `api/server.js` e `api/routes/`.
- Ambiente: `api/.env.example`, `api/database/connection.js` e `api/server.js`.
- Frontend: `app/*.html` e seus scripts referenciados em `app/js/`.
- Arquitetura, limitações e instalação: `DOCUMENTACAO.md`.

## Skills locais
Local: `.agents/.agents/skills/<nome>/SKILL.md`.

| Skill | Quando usar |
| --- | --- |
| `finish-partial-work` | Concluir funcionalidade parcial de ponta a ponta |
| `secure-coding` | Código em limites de confiança |
| `sql-injection-prevention` | Queries, filtros e ORM |
| `secrets-hygiene` | Config, tokens e credenciais |
| `dependency-supply-chain` | Dependências e auditoria SCA |
| `code-review` | Revisão de alterações e regressões |
| `security-audit` | Auditoria aprofundada de segurança |

## Nunca fazer
- Imprimir arquivos inteiros para explicar alterações pequenas.
- Fazer buscas indiscriminadas ou ler dependências sem necessidade.
- Tratar permissões do frontend como autorização no servidor.
- Concatenar/interpolar input em SQL ou hardcodar/logar segredos.
- Declarar build, testes ou integrações validados sem execução e evidência.
