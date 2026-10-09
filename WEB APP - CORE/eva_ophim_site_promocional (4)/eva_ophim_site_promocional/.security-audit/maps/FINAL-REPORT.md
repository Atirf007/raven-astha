# Executive Summary

Map pipeline before: o editor serializava o blueprint completo, mas a Central de Mapas possuía um renderizador paralelo que percorria somente `floors[0].shelves`.

Map pipeline after: o schema v2 é normalizado por um módulo canônico compartilhado; os dois renderizadores 3D consomem o mesmo modelo e suportam todos os andares e tipos documentados.

Original bug: paredes, portas, janelas, pilares, escadas, zonas e rotas apareciam no editor, mas desapareciam no visualizador.

Root cause: reconstrução independente e incompleta da cena no `buildWarehouse3D()` da Central de Mapas.

New map entities implemented: máquinas, empilhadeiras e docas.

Existing entities improved: paredes, portas, janelas, pilares, estantes, escadas, zonas, rotas e addons passaram pelo modelo canônico e por enquadramento dinâmico.

Performance before: NOT_MEASURED.

Performance after: fixture visual rotacionada com 15 entidades construída em 67,5 ms; 57 draw calls, 622 triângulos, 55 geometrias e 2 texturas. O modelo canônico processou 1.200 entidades em mediana de 0,614 ms.

Security impact: validação de tamanho, quantidade, números, extensões e URLs; autorização e isolamento por organização preservados; SQL parametrizado.

Compatibility impact: plantas sem versão são promovidas para `schemaVersion: 2`; coleções ausentes recebem arrays vazios.

Tests added: 12 casos de mapa/persistência nas suítes e um benchmark reproduzível. Tests passed: 52/52 em duas passagens consecutivas; 6/6 verificações de sintaxe.

Remaining limitations: sem baseline de desempenho anterior, sem integração com MySQL real e sem teste em GPUs/navegadores adicionais.

# Files Changed

- `app/sistema.html`
- `app/js/sistema-map-model.js`
- `app/js/sistema-builder-2d.js`
- `app/js/sistema-builder-3d.js`
- `api/security/blueprint.js`
- `api/routes/warehouse.js`
- `tests/security/map-pipeline.test.js`
- `tests/security/tenant-routes.test.js`
- `tests/performance/map-model-benchmark.js`
- `tests/visual/map-preview-server.js`
- `DOCUMENTACAO.md`
- `.security-audit/maps/metrics.json`

# Root Cause

O editor CAD usava o blueprint completo. A Central de Mapas mantinha outra montagem Three.js que selecionava exclusivamente `floors[0].shelves` e deduzia o restante da cena. Assim, salvar funcionava, mas o consumidor final ignorava quase todas as entidades e todos os andares adicionais. A correção introduziu `normalizeBlueprint()` e `createScenePlan()` como contrato único entre persistência, editor e viewer.

# Blueprint Schema

Schema atual: versão 2, unidades `cm`, até 20 andares e 2.000 entidades por coleção/andar. Tipos: `wall`, `door`, `window`, `pillar`, `shelf`, `stairs`, `zone`, `path`, `machine`, `forklift`, `dock` e `addon`. Coordenadas 2D `(x,y)` viram `(x,z)`; a elevação vem do andar. Retângulos usam seu centro e linhas usam o ponto médio e ângulo calculado.

# 2D → 3D Mapping Matrix

| Entity | 2D | Persist | 3D | Tested |
| --- | --- | --- | --- | --- |
| Wall, door, window, pillar | YES | YES | YES | YES |
| Shelf, stairs | YES | YES | YES | YES |
| Zone, path/route | YES | YES | YES | YES |
| Machine, forklift, dock | YES | YES | YES | YES |
| Addon | YES | YES, sem blob persistido | YES | YES |
| Multiple levels | YES | YES | YES | YES |

# Performance

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| Scene build, 15 entities | NOT_MEASURED | 67,5 ms | UNKNOWN |
| Draw calls | NOT_MEASURED | 57 | UNKNOWN |
| Triangles | NOT_MEASURED | 622 | UNKNOWN |
| Geometry/texture count | NOT_MEASURED | 55 / 2 | UNKNOWN |
| Canonical plan, 25/250/1.200 | N/A | 0,062 / 0,131 / 0,614 ms median | N/A |
| Render scheduling | contínuo | sob demanda | IMPROVED |

# Optimization Applied

- Renderização sob demanda ligada a alterações de câmera e resize.
- DPR limitado a 1,5; sombras ativadas apenas em qualidade alta.
- Cache de geometrias e materiais compartilhados na cena central.
- Descarte recursivo deduplicado de geometrias, materiais, texturas, controles e observer.
- Enquadramento por bounds reais e suporte a todos os andares.

`InstancedMesh`, LOD e FPS/heap não foram implementados ou medidos; o cenário atual favoreceu menor risco e compatibilidade.

# Security Validation

- Blueprint limitado a 1 MiB, 20 andares, 2.000 entidades por tipo/andar, 10.000 entidades totais e orçamento de renderização de 30.000.
- Números não finitos e dimensões fora dos limites são rejeitados ou normalizados.
- Modelos persistidos não podem iniciar fetch externo; somente blobs locais temporários são aceitos no editor e são removidos pela API.
- Escrita exige JWT, organização e papel `superadmin`, `admin` ou `manager`.
- Query de persistência permanece parametrizada e inclui `org_id`.
- Revisões de XSS, secrets, processo, RAF recursivo e SQL dinâmico não confirmaram nova falha no escopo alterado.

# Regression Tests

- Compatibilidade de blueprint antigo e ciclo JSON save/load.
- Cobertura estrutural de todos os tipos no plano 3D.
- Coordenadas, rotação e elevação por andar.
- Entidades invisíveis/desconhecidas.
- Limites e neutralização de URL externa.
- Consumo do modelo canônico e ausência de RAF contínuo.
- Rejeição antes do banco e persistência normalizada com tenant lock.
- Suíte de segurança: 52/52, repetida duas vezes após a última alteração relevante de segurança.

# Visual Validation

PASS em browser local, viewport 1440×900. A fixture exibiu paredes, abertura, janela, pilares, estantes, escada, zona, rota, máquina, empilhadeira e doca em uma cena enquadrada. A aba Industrial exibiu as ferramentas Machine, Forklift e Dock. A troca viewer/editor não deixou o painel 2D órfão. Screenshots foram capturados e inspecionados na sessão; arquivo persistente: SCREENSHOT_NOT_AVAILABLE.

# Known Limitations

- O benchmark anterior à correção não foi registrado; deltas numéricos são UNKNOWN.
- Renderização cresce em draw calls com estantes detalhadas; `InstancedMesh` ainda é candidato para plantas muito grandes.
- Addons importados são blobs locais e não sobrevivem como asset 3D persistente; falta armazenamento autenticado próprio.
- DAST com API/MySQL real, FPS, heap trend e matriz de GPU/browser: NOT_EXECUTED.
- Git CLI: NOT_AVAILABLE; `git diff --check`, commit e PR não foram executados.

# Recommended Next Steps

1. Criar endpoint autenticado de assets 3D com limite, validação de formato e autorização por organização.
2. Aplicar instancing nas estantes após medir uma planta produtiva representativa.
3. Adicionar o teste de mapa e o benchmark a um gate de CI quando o projeto definir um runner.

# Evidence

- Métricas: `.security-audit/maps/metrics.json`.
- Fixture visual: `tests/visual/map-preview-server.js`.
- Testes: `tests/security/map-pipeline.test.js` e `tests/security/tenant-routes.test.js`.
- Benchmark: `tests/performance/map-model-benchmark.js`.
- Horário registrado: 2026-09-15T07:24:43.9510641-03:00.

Status: CONVERGED dentro do escopo do mapa web e dos métodos executados. Nenhuma vulnerabilidade Critical/High confirmada permanece nesse escopo após duas passagens consecutivas.
