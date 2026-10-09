# Executive Summary

Security posture before: múltiplas falhas confirmadas em autenticação, autorização, XSS, upload, sessões e distribuição.
Security posture after: controles centrais corrigidos e 32 testes de segurança passam; riscos médios e limitações permanecem.
Confirmed findings: 12. Critical: 0. High: 6. Medium: 5. Low: 1.
Fixed: 9. Remaining: 3. Regression tests added: 32.
Functional regression: testes específicos PASS; build Electron PASS; E2E com MySQL real NOT_EXECUTED.
Security cycles completed: 3, incluindo duas passagens consecutivas após a última alteração relevante.
Convergence: CONVERGED para Critical/High confirmados no escopo testado.
Residual risk: MEDIUM, principalmente Electron EOL, schema/migrações inconsistentes e sinks DOM legados.
Primary blockers: Git/scanners dedicados/IAST indisponíveis; MySQL isolado não provisionado; produção não autorizada.

A auditoria encontrou emissão de sessão OAuth sem prova do provedor, JWT revogado ainda aceito, BOLA entre tenants, autorização apenas na UI, XSS persistente, uploads ativos e `.env` dentro do instalador. Os patches aplicam validação no servidor, consulta de sessão/usuário atual, filtros de organização, papéis, encoding contextual, validação de conteúdo de arquivos e allowlist de conteúdo estático. O `.env` foi removido do artefato local e excluído de builds futuros. Isto não é garantia de ausência de vulnerabilidades.

# Scope and Assumptions

Incluído: `api/`, `app/`, entrypoints Electron, manifests/locks, schema/migrações, Nginx e artefato Windows. Excluído: `old/` como implementação não canônica, dependências vendorizadas para revisão semântica e sistemas externos. Produção/staging/cloud/TLS real: UNKNOWN. DAST de produção, força bruta, exploração destrutiva: NOT_EXECUTED. Git HEAD/branch/diff: NOT_AVAILABLE; executável Git ausente. Alterações anteriores foram preservadas por manifesto SHA-256 antes das edições, sem ler `api/.env`.

# Architecture and Attack Surface

| Componente | Tipo | Stack/entrypoint | Trust boundary | Dados/exposição | Testes |
| --- | --- | --- | --- | --- | --- |
| Desktop | cliente | Electron / `main.js` | host ↔ processo API | configuração local | build |
| Web | frontend | HTML/JS / `app/sistema.html` | browser ↔ API | JWT, PII, estoque | XSS/jsdom |
| API | serviço REST | Express / `api/server.js` | público ↔ app ↔ DB | auth/admin/tenant | HTTP efêmero |
| Banco | persistência | MySQL/schema.sql | app ↔ DB; tenant A ↔ B | credenciais, PII, estoque | pool simulado |
| Visualizador | site separado | Nginx/Three.js | Internet ↔ arquivos | modelos industriais | revisão estática |

Fluxos críticos: input HTTP → validação/autorização → SQL parametrizado; token do provedor → JWKS fixo → assinatura/audience/issuer → conta; material/tenant → anexos/estoque → MySQL; registros SQL → templates DOM.

# Threat Model

Assets: credenciais, JWT, PII, dados de organizações, estoque e modelos. Actors: anônimo, viewer/operator/manager/admin/superadmin, tenant concorrente e dependência comprometida. Entradas: body/query/headers, JWT/OAuth, arquivos base64/URLs e registros DB. Sinks: SQL, DOM/HTML, redirects, filesystem estático, logs e instalador. Principais ameaças validadas: impersonação OAuth, replay de sessão, escalada horizontal/vertical, XSS persistente, conteúdo ativo em upload e vazamento de segredo por build.

# Tools and Skills

| Técnica | Tool/Skill | Versão | Input/Output | Findings | Limitações | Artifact |
| --- | --- | --- | --- | --- | --- | --- |
| revisão segura | secure-by-default, sql-injection-prevention, secrets-hygiene, code-review | local | fontes/diff lógico | auth/authz/XSS/config | Git indisponível | este relatório |
| SCA | npm audit | 11.17.0 | 3 lockfiles/JSON | 0 advisories | CVEs desconhecidos/runtime Electron fora do escopo | `supply/*-audit.json` |
| SBOM | npm sbom | 11.17.0 | CycloneDX | raiz/API | js bloqueado EINVALIDPURLTYPE | `supply/*sbom*` |
| DAST dirigido | node:test + Express loopback | Node 24.19.0 | HTTP sentinels | CORS/static/auth | banco simulado | testes |
| XSS | jsdom + node:test | jsdom 29.1.1 | sentinels DOM | 4 causas | páginas legadas não completas | `frontend/*` |
| SAST/secrets | revisão data-flow + rg | N/A | fontes | achados confirmados | Semgrep/CodeQL/gitleaks NOT_AVAILABLE | outputs resumidos |
| container/IaC | inventário | Docker CLI 29.7.2 | repo | N/A | daemon indisponível; definições ausentes | `supply/REPORT.md` |

IAST: NOT_AVAILABLE. Fuzzing dedicado: NOT_EXECUTED; validadores receberam casos de borda/sentinels determinísticos. Codex Security plugin: NOT_AVAILABLE.

# Methodology

Baseline por snapshot/hashes; arquitetura e threat model; SAST semântico e heurístico; secrets/SCA/SBOM/supply chain; reprodução local; patches mínimos; regressões; HTTP local; build; revisão adversarial; duas passagens completas finais. Nenhum alvo remoto foi testado.

# Findings Summary

| ID | Título | Severidade | Score | Confiança | Componente | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-001 | OAuth aceitava identidade não verificada | High | 9.0 | alta | auth | FIXED |
| SEC-002 | JWT revogado/inativo e claims antigos eram aceitos | High | 8.5 | alta | sessão | FIXED |
| SEC-003 | BOLA entre organizações | High | 8.5 | alta | rotas DB | FIXED |
| SEC-004 | Escritas sensíveis sem papel no servidor | High | 8.0 | alta | API | FIXED |
| SEC-005 | XSS persistente em dados do domínio | High | 8.0 | alta | frontend | FIXED no frontend canônico testado |
| SEC-006 | `.env` incluído no instalador | High | 8.0 | alta | build | FIXED local; rotação externa pendente |
| SEC-007 | Convite permitia papel indevido/replay concorrente | Medium | 6.5 | alta | auth | FIXED |
| SEC-008 | Upload confiava em nome/MIME/URL | Medium | 6.5 | alta | anexos | FIXED |
| SEC-009 | Raiz do repositório servida por HTTP | Medium | 6.0 | alta | servidor | FIXED |
| SEC-010 | Sinks DOM em mapa/implementações não canônicas | Medium | 5.5 | média | frontend legado | ACCEPTED_RESIDUAL_RISK |
| SEC-011 | Electron 30.5.1 fora de suporte | Medium | 5.0 | alta | runtime | BLOCKED |
| SEC-012 | Ordem de regex Nginx/hardening HTTP | Low | 3.0 | média | deploy separado | ACCEPTED_RESIDUAL_RISK |

Scores são `INTERNAL_RISK_SCORE`; CVSS/CWE/ASVS IDs não foram inventados. Mapeamento geral verificado: OWASP Top 10 Broken Access Control, Security Misconfiguration, Supply Chain, Injection, Insecure Design, Authentication e Integrity Failures.

# Detailed Findings

SEC-001: body controlava email → lookup/criação → `jwt.sign`; não havia validação do provedor. Agora aceita somente JWT RS256 validado contra endpoint fixo, `kid`, issuer, audience, exp/sub e email verificado; teste rejeita Google/Microsoft sem prova antes de tocar DB.

SEC-002: JWT assinado → middleware → claims confiados, sem sessão/usuário atual. Agora algoritmo é fixo, segredo fraco falha na inicialização, e sessão, expiração, usuário ativo, papel e tenant são recarregados do DB. Testes cobrem revogação, claim antigo, assinatura e tenant ausente.

SEC-003/004: IDs/códigos → queries sem `org_id`; rotas aceitavam qualquer autenticado. Warehouse, componentes, anexos, materiais e movimentos agora filtram tenant e aplicam papéis; operações de estoque bloqueiam linhas. Testes com TENANT_A/recurso estrangeiro passam.

SEC-005: registros/nomes → template string → `innerHTML`. Saídas centrais usam encoding ou nós/textContent e callbacks usam dados do DOM. Sete testes XSS passam. Sinks do mapa inline/legado ficam em SEC-010.

SEC-006: `package.json` incluía `api/.env` e o arquivo existia em `dist`. Exclusions foram adicionadas, o artefato foi removido e um novo instalador foi gerado sem `.env`. Credencial possivelmente distribuída exige rotação externa.

SEC-007: role/email de convite não eram restringidos adequadamente e claim era check-then-act. Papel agora usa allowlist por ator, email vinculado é conferido e `used_at` é tomado por UPDATE condicional antes da criação.

SEC-008/009: anexos agora têm 10 MiB, nome seguro, assinatura/formato allowlisted, glTF autocontido e URL HTTPS sem credenciais; download força tipo derivado/attachment. Servidor expõe somente diretórios/extensões públicas, reduz body, fecha CORS `null`, remove X-Powered-By e aplica no-store.

# Remediation Applied

Arquivos centrais: `api/security/*`, middleware/rotas API, `api/server.js`, `app/js/*`, `package.json`, `database/schema.sql`, `.env.example` e testes. Credenciais padrão foram removidas do schema/init. Compatibilidade: OAuth requer configuração real e validação do provedor; sessões antigas deixam de funcionar se não existirem na tabela; URLs HTTP de anexo são rejeitadas; viewer não escreve. Commits: NOT_AVAILABLE. Nenhum push/deploy foi feito.

# Security Regression Tests

32 testes: 5 auth/sessão, 13 tenant/upload, 7 XSS, 4 HTTP/build e 3 revisão backend. Todos passaram em três ciclos; duas passagens completas consecutivas passaram depois da última alteração relevante.

# Functional Regression

Build `npm run build`: PASS fora do sandbox após EPERM inicial; gerou instalador Windows e blockmap. Syntax checks: PASS. Testes funcionais existentes não formam suíte. MySQL/E2E/login real: NOT_EXECUTED para evitar banco configurado e migrações destrutivas. Delta: nenhum teste automatizado preexistente comparável.

# Dependency and SBOM Analysis

Três audits: 0 advisories. CycloneDX raiz/API gerado; js BLOCKED por manifesto sem name/version. Electron 30.5.1 EOL permanece e requer migração major testada. Métricas/hashes em `supply/`.

# Supply Chain Review

Lockfiles v3, registry npm e integrities presentes. Build futuro exclui env/chaves/migrações. Runtime download Electron/Puppeteer e ausência de provenance/signing permanecem recomendações. Nenhuma dependência foi adicionada ou atualizada.

# CI/CD Review

Pipelines: NOT_APPLICABLE, não encontrados. Branch protection/release remoto: UNKNOWN.

# Infrastructure / Container Review

Dockerfile/Kubernetes/IaC: NOT_APPLICABLE, ausentes. Docker daemon: NOT_AVAILABLE. Nginx separado revisado; TLS real UNKNOWN.

# Runtime Testing

Express efêmero em loopback, DB simulado: PASS para auth, CORS, headers, rotas e exposição estática. DAST amplo: NOT_AVAILABLE. Produção: NOT_EXECUTED.

# Logs and Detection

| Teste | Esperado | Observado | Leakage | Resultado |
| --- | --- | --- | --- | --- |
| CORS inválido | 403 | `[HTTP_ERROR] 403` | não | PASS |
| erro schema sentinel | 500 genérico | resposta genérica; log ainda inclui stack em warehouse | estrutura de teste, sem segredo | FAIL hardening |
| contato | evento sem PII | rótulo fixo | não | PASS |

# Before vs After Metrics

| Técnica | Antes C/H/M/L | Depois aberto C/H/M/L | Confirmados | Status |
| --- | --- | --- | --- | --- |
| manual/data-flow | 0/6/4/1 | 0/0/2/1 | 11 | PASS com residual |
| SCA | 0/0/0/0 | 0/0/0/0 | 0 | PASS |
| DAST dirigido | 0/3/2/0 | 0/0/0/0 | 5 | PASS |
| XSS jsdom | 0/1/0/0 | 0/0/1/0 | 2 causas/escopos | PASS parcial |

SAST/DAST/IAST/Fuzz/Manual/SCA por finding: SEC-001 manual+DAST YES; SEC-002 manual+DAST YES; SEC-003/004 manual+DAST YES; SEC-005 manual+jsdom YES; SEC-006 manual+build YES; SEC-007 manual+static test YES; SEC-008 manual+DAST YES; SEC-009 manual+DAST YES; SEC-010 manual YES; SEC-011 SCA NO/manual YES; SEC-012 manual YES. Demais modalidades N/A ou NOT_RUN.

# Audit Cycles

Cycle 0 reproduziu auth/sessão, tenant e XSS e registrou SCA/build. Cycle 1 corrigiu causas centrais. Cycles 2 e 3 reexecutaram os 32 testes após a última alteração, ambos exit 0, sem novo Critical/High confirmado.

# Convergence

CONVERGED

Nenhum Critical/High confirmado permaneceu aberto dentro do escopo e métodos executados após duas passagens consecutivas. A convergência não cobre produção, E2E MySQL, frontend legado integral ou vulnerabilidades desconhecidas.

# Residual Risks

SEC-010/011/012; schema ainda usa campos/tabela de eventos sem migração consolidada; logs podem ser melhor estruturados; token de download em query permanece temporariamente compatível e pode aparecer em infraestrutura externa, mitigado por no-store/no-referrer.

# Blockers

Sem Git, Semgrep, CodeQL, gitleaks, IAST, daemon Docker, staging ou banco descartável completo.

# Manual Actions Required

- `ROTATE_CREDENTIAL_EXTERNALLY`: rotacionar DB/JWT se qualquer instalador com `.env` foi distribuído e retirar artefatos antigos.
- Migrar Electron para major suportada com E2E.
- Consolidar schema/migrações e testar instalação limpa em MySQL isolado.
- Definir TLS/proxy de produção e revisar Nginx separado.

# Recommended CI Security Gates

PR: 32 testes, syntax, npm audit, secrets e SAST. Release: build, inspeção que proíbe `.env`/chaves, SBOM, provenance e smoke. Nightly: SCA/SAST/DAST em staging. Falhar em secret real, regressão, novo High/Critical confirmado ou dependência High alcançável; exceptions exigem ID, owner, motivo, expiração e controle compensatório.

# Commit / PR Summary

Git indisponível; mudanças permanecem no workspace. Título sugerido: `Security: harden authentication, tenant isolation, uploads and packaging`.

# Evidence Index

`baseline/manifest.json`, `baseline/auth-session*`, `frontend/pre-fix*`, `frontend/post-fix*`, `tenant/pre-fix.txt`, `tenant/post-fix.txt`, `supply/REPORT.md`, audits, SBOMs, hashes e testes em `tests/security/`. Evidências não contêm conteúdo de `.env`, tokens ou headers Authorization reais. Screenshot: SCREENSHOT_NOT_AVAILABLE.

# Timeline

```mermaid
timeline
    title Auditoria real
    2026-09-14 20:09Z : baseline e inventário
    2026-09-14 20:10Z : SCA, SBOM e reproduções
    2026-09-14 20:20Z : remediação e regressões
    2026-09-15 00:08Z : build final e reauditorias
```

| Fase | Início | Fim | Duração | Status |
| --- | --- | --- | --- | --- |
| Auditoria completa | 2026-09-14T20:09:37Z | 2026-09-15T00:07:57Z | 3h58m20s | concluída com limitações |

# Final Checklist

Threat model PASS; SAST PASS manual/heurístico; semantic review PASS; SCA PASS; SBOM PASS parcial; supply chain PASS; secrets PASS no escopo; CI/CD N/A; IaC N/A; containers N/A; authn/authz/session PASS; CSRF N/A bearer-only; XSS PASS canônico/residual legado; SQL injection PASS; NoSQL/template/XXE/deserialization N/A; command injection PASS por ausência de fluxo; path traversal N/A armazenamento DB; upload PASS; SSRF PASS por endpoints fixos/URLs sem fetch server; redirects PASS; race PASS estoque/convite; timing PASS bcrypt/JWT; crypto PASS; CORS/headers PASS; CSP FAIL compatibilidade não testada; TLS NOT_EXECUTED; logging FAIL hardening; DAST PASS dirigido; IAST NOT_AVAILABLE; fuzzing NOT_EXECUTED; business logic PASS dirigido; regression/full targeted tests PASS; full E2E NOT_EXECUTED; independent re-audit PASS; second clean pass PASS; evidence sanitized PASS; final diff review BLOCKED Git; final report PASS.

# Final Statement

Nenhuma vulnerabilidade confirmada de severidade Critical/High foi identificada como aberta dentro do escopo, versões, ambiente e métodos executados após duas passagens consecutivas. Permanecem riscos médios, ações externas e áreas não executadas explicitamente descritas acima.
