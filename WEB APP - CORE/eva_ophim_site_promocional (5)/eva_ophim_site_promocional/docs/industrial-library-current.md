# Biblioteca industrial e mapa 2D/3D — estado em 08/10/2026

Este relatório substitui o inventário de pendências da etapa inicial. A biblioteca executável contém os **248 tipos da especificação**: 208 industriais em 16 categorias e 40 complementares de arquitetura, elétrica e redes. Os nove modelos básicos anteriores continuam disponíveis, totalizando 257 opções. O editor faz parte de `app/sistema.html`, com os dados e a autenticação do WMS existente.

## Implementação atual

- Catálogo com IDs estáveis, versão, dimensões em SI, limites e capacidades por família. `scripts/build-industrial-catalog.py` gera `app/js/sistema-industrial-catalog.js`; `app/industrial-library-roadmap.json` registra os 248 como `implemented-parametric`.
- Geometrias autorais reconhecíveis e paramétricas para os 248 tipos. Mesma fábrica no editor, visualizador e miniaturas. Base no piso e dimensões físicas normalizadas; níveis/módulos de racks, roletes, inclinação e degraus modificam a geometria nas famílias compatíveis. Variantes padrão, compacta e ampliada.
- Biblioteca com pesquisa sem acentos, categorias, dimensão máxima, favoritos e recentes locais; 16 miniaturas por página, produzidas pela fábrica real e armazenadas em cache. Painel esquerdo, planta e perspectiva centrais, propriedades à direita; painéis recolhíveis e composição vertical em telas menores.
- Inspetor em metros: posição X/Y, elevação Z, comprimento, largura, altura, rotação, variante, parâmetros, cor, camada, grupo, bloqueio, visibilidade e pavimento. A persistência continua em centímetros no schema 2, compatível com plantas anteriores.
- Enquadramento inicial da planta 2D com base nos objetos visíveis; botão **Enquadrar planta**. Redimensionar preserva a navegação manual ou recalcula o enquadramento automático.
- Footprints rotacionados, retangulares ou elípticos conforme o tipo. Avisos distintos de interseção física, área operacional e acesso para manutenção; elevação e altura evitam conflitos entre objetos separados verticalmente. Encaixe à grade opcional e conectores compatíveis nas famílias com portas definidas. Curvas e peças com múltiplas portas não anunciam conectores incompletos.
- Grupos preservam deslocamentos relativos; membros bloqueados impedem movimento do conjunto. Camadas podem ser ocultadas e mostradas. Objetos ocultos continuam selecionáveis na lista para recuperação.
- Copiar/colar por atalhos e botões acessíveis. Cópias são independentes, têm ID novo e removem vínculos de ativo/grupo/conectores. Prateleiras exigem código exclusivo em diálogo centralizado e nascem com posições livres; materiais continuam na original. Desfazer/refazer com até 100 estados locais.
- Vínculo a ativos físicos autorizado pelo servidor. Condição, criticidade, ordens, documentos, módulos e posições/componentes instalados; ficha completa e histórico usam o workspace EAM existente. Não são inventados indicadores de operação quando não há observações cadastradas.
- Dois níveis de detalhe: perto com instanciamento de primitivas por material; longe com malha única por equipamento e cores por vértice, mantendo todas as peças. Renderização sob demanda quando estática; animação visual opcional de transportadores, sem simulação física de produção.

Os modelos representam equipamentos genéricos para planejamento de layout. Não reproduzem especificações de fabricantes nem demonstram conformidade normativa. As áreas de acesso são editáveis e não constituem um cálculo de segurança industrial certificado.

## Importação e limites de confiança

GLB 2 e glTF 2 com buffers incorporados passam por worker no navegador e **nova validação independente** em worker Node no servidor. O subconjunto aceito é de malhas triangulares estáticas, transforms de hierarquia, posições/índices e cor base. Recursos externos, texturas/imagens, extensões, skins, animações e accessors sparse são recusados com mensagem. Nenhuma URL do arquivo é buscada na rede.

Limites: 8 MiB por arquivo, 50.000 triângulos por modelo, 1.000 nós, profundidade 64; até 100 importações e 800 MiB de origem por organização; no mapa, até 500.000 triângulos importados, conferidos com metadados armazenados pelo servidor. Workers do servidor têm tempo de 5 s e limite de memória, no máximo dois simultâneos; a rota limita cinco pedidos por minuto por organização/usuário.

Importações guardam origem, licença, hash e geometria validada. Instâncias persistem referência ao modelo autorizado naquele mapa, sem URL temporária. Reabrir não substitui importações por caixas; o objeto aparece quando sua geometria autorizada termina de carregar.

Blueprints têm limite de 1 MiB, 10.000 entidades e orçamento de complexidade. O servidor resolve defaults do manifesto, valida versões/parâmetros e rejeita IDs duplicados ou referências inconsistentes. Todas as consultas usam parâmetros e escopo de organização/mapa da sessão, com RBAC e restrições de grupos. As permissões da interface não concedem acesso no servidor.

## Rascunhos, revisões e ativação do MySQL

`api/services/industrial-map.js` publica em transação com bloqueio do layout e comparação de revisão, rejeitando conflitos com HTTP 409. Cada publicação armazena snapshot, hash, autor e data; a auditoria das instâncias é definida pelo servidor. Rascunhos são privados por usuário/mapa e não alteram a versão publicada. Autosave serializa gravações e usa snapshots para conservar edições feitas durante publicação. Restaurar rascunho ou revisão abre uma cópia editável; o histórico publicado permanece intacto.

**Bloqueio atual:** a conta local `astha_lab_web` não tem `CREATE`, e a consulta de readiness retornou zero das três tabelas industriais. O usuário informou que executará o SQL no MySQL Workbench. Isso ainda não confirma que a execução terminou.

Execute `api/database/industrial-map.sql` com administrador no laboratório `astha_raven_lab`. O script cria aditivamente `warehouse_model_imports`, `warehouse_map_revisions` e `warehouse_map_drafts` e concede somente as operações necessárias à conta existente. Não usa `init.js` nem `migrate.js`, não remove dados e não altera tabelas existentes. Revisões/importações recebem SELECT/INSERT; rascunhos recebem SELECT/INSERT/UPDATE/DELETE.

Após a execução, reinicie a API a partir de `api/` e recarregue o mapa. Sem readiness, a interface informa a migração necessária e desabilita o autosave; não anuncia salvamento que não aconteceu.

Verificação preparada para a ativação:

```powershell
node api/tools/verify-industrial-map.cjs
```

Usa apenas o perfil protegido de laboratório e fixtures próprias em organizações isoladas. Cobre sessões reais, autorização, rascunho privado, publicação concorrente, reabertura, vínculo EAM estrangeiro, importação por worker, referência persistente e imutabilidade da revisão anterior. Ao encerrar, revoga sessões, desativa seus usuários e arquiva seus mapas; publicações/importações de teste mantêm sua linhagem. **Este teste não passou no banco atual: a primeira tentativa falhou por permissão CREATE antes de criar fixtures.**

Rollback de código deve preservar as três tabelas e os snapshots. Não faça DROP como procedimento de rollback; modelos referenciados e revisões precisam ser mantidos. Faça backup e use uma versão do backend compatível com os dados antes de reverter.

## Verificações executadas

- 41 testes Node de contratos, isolamento/autorização das rotas, validação, colisões/conectores, parser e worker de importação, edição e concorrência de autosave/publicação passaram. Posteriormente passaram os testes adicionais de enquadramento e de base64 no limite de 8 MiB.
- `test-object-library.cjs`: 257 IDs/contratos e round-trip de metadados; inventário 248/248.
- `test-cad-clipboard.cjs`: cópias independentes, deslocamento, tipo preservado, código único, prateleira vazia e cancelamento.
- `test-shelf-selection.cjs`: SH-1 → SH-2 → SH-1 atualiza grade/foco; ausência de mapa/3D tratada e scripts inline compilados.
- Navegador com Three.js real: 257 modelos em três escalas; medidas/bounds e apoio no piso dentro de 0,01 cm. 496 casos de parâmetros mínimo/máximo dos 248 tipos, com dois níveis de detalhe.
- Fixture de UI carregando os módulos reais: alterações de dimensões/parâmetros, rotação/elevação, desfazer/refazer e colagem independente. Essa fixture não comprova autenticação nem gravação MySQL.
- App real com sessão de QA no laboratório: biblioteca e geometrias 2D/3D, leitura de ativo pela API e abertura da ficha EAM existente; colagem pelo botão abre diálogo centralizado, rejeita `SH-QA` duplicado e aceita `SH-QA-2`.
- Atalhos de clipboard têm testes do controlador; a emissão Ctrl+C/Ctrl+V do navegador de automação não confirmou o fluxo completo. Os botões Copiar/Colar confirmaram o mesmo controlador no app.
- Tela 390 × 844 sem overflow horizontal do documento; visualização e campos têm rolagem própria. Desktop verificado em 1600 × 900. Ainda não é homologação de acessibilidade por leitor de tela ou de todos os dispositivos.

Os resultados do benchmark executável ficam em `tests/ui/artifacts/industrial-browser-results.json`. Usa viewport de render 1000 × 600, DPR 1, 64 frames com quatro de aquecimento e 60 amostras, p95 de `renderer.render` + `gl.finish` pelo método nearest-rank, WebGL ANGLE/Intel Iris Xe/Direct3D11. FPS é o equivalente do tempo de renderização, não FPS contínuo de toda a aplicação; memória indica buffers de geometria, não memória total do processo. Não generalize o resultado a outros hardwares ou cenas.

| Instâncias | Construção | Render p95 | Meta p95 | Draw calls | Buffers de geometria |
| --- | --- | --- | --- | --- | --- |
| 25 | 41 ms | 2 ms | 33,33 ms | 28 | 0,68 MiB |
| 250 | 288 ms | 8,6 ms | 33,33 ms | 250 | 6,74 MiB |
| 1.200 | 1.095 ms | 40,3 ms | 66,67 ms | 1.200 | 32,32 MiB |

As três metas de p95 passaram após a otimização final. A amostra de 1.200 teve um frame máximo de 335,6 ms, apesar da mediana de 29,9 ms; isso não garante ausência de travadas ocasionais. A construção é síncrona na fábrica e continua sendo um custo relevante em mapas grandes. O agrupamento do LOD distante reduz draw calls, com aumento de buffers em relação às primitivas instanciadas separadas.

Evidências: `tests/ui/artifacts/industrial-workspace-desktop.png`, `industrial-workspace-mobile.png`, `industrial-centered-dialog.png` e a imagem histórica `industrial-library-phase1.png`. Nenhuma evidência contém token ou credencial. As abas e os servidores temporários de verificação são encerrados; usuários sintéticos são desativados e seus mapas arquivados.

## Pendências para encerrar a homologação

1. Confirmar execução da migração e grants no Workbench. Conferir as três tabelas com a conta do app.
2. Executar e corrigir eventuais falhas do teste HTTP/MySQL preparado; ainda não há evidência de persistência real dessas tabelas.
3. No navegador, publicar/reabrir com parâmetros, importação e vínculo EAM; testar recuperação de rascunho e revisão anterior após ativação.

Nenhum build Electron, implantação ou homologação de produção foi declarado executado nesta entrega.
