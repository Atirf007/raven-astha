# Plano de implementação integrado — ASTHA RAVEN

30/09/2026 · extensão v2 · planejamento, sem implementação no aplicativo.

## 1. Resultado pretendido e limites desta etapa

Construir um estúdio dentro do ASTHA que transforme registros de manutenção, configuração, estoque e compras em estudos reproduzíveis e decisões revisáveis. O usuário parte de uma pergunta — “o que causa indisponibilidade?”, “quantas peças reservar?”, “esta troca melhorou o desempenho?” — e recebe uma população definida, dados verificáveis, método apropriado, diagnóstico e limitações.

Este documento detalha onde integrar, o que reutilizar, quais módulos construir, contratos, sequência, aceites e operação. Os caminhos novos são propostas: não foram criados no repositório. As imagens são conceitos com dados fictícios. A análise é estática; não valida banco real, desempenho, comportamento em execução ou qualidade histórica.

O pedido por ferramentas “inexistentes em softwares opensource” é tratado como oportunidade de composição industrial. Não há evidência para declarar inexistência mundial. JASP já oferece amplo repertório estatístico, incluindo distribuições e análises de vários domínios; criar outro teste t não diferencia o ASTHA. A oportunidade está na ligação entre semântica industrial, histórico operacional e fluxo de decisão. [Catálogo oficial JASP](https://jasp-stats.org/features/).

## 2. Mapa de reaproveitamento comprovável

Referências de linha representam os arquivos examinados nesta etapa. Reutilização deve preservar autorização no servidor, identidade da organização e regras operacionais; dados em caches do navegador não são uma fonte estatística autoritativa.

| Peça existente | Evidência | Reaproveitamento proposto | Limite / trabalho necessário |
|---|---|---|---|
| Cliente HTTP | `app/js/api.js:6`, `:26`, `:87` | Usar `API.request/get/post` para metadados, jobs e resultados | Examinar cache, erro de sessão, cancelamento e payload; upload binário precisa caminho próprio |
| Entrada EAM | `app/js/sistema-core.js:220`, `:271` | Inserir acesso ao estúdio e abrir estudo a partir de ativo/ordem | Evitar criar mais substituições sucessivas de funções globais |
| Catálogo de ativos | `app/js/sistema-core.js:238`; `app/js/eam-ux.js:14` | Alimentar seletores e contexto inicial | Buscar recorte novamente no servidor; não congelar estudo a partir do cache visual |
| Indicadores atuais | `app/js/sistema-core.js:582`, `:583`; `app/js/eam-ux.js:37` | Preservar entrada familiar; adicionar “Examinar evidências” e “Criar estudo” | Rever definição e denominadores antes de usar como referência de validação |
| Visualização técnica | `app/js/eam-visual-workspace.js:1255` | Abrir componente/posição vinculado a episódio e mostrar contexto técnico | Estado atual não demonstra configuração no instante histórico |
| Histórico e snapshots técnicos | `api/routes/eam-completion.js:26`, `:33`, `:42` | Referenciar versão técnica e comparar configurações | Snapshots técnicos não substituem snapshot analítico imutável |
| Planejamento MRP | `api/services/mrp-planner.js:12`, `:62`; `api/routes/procurement.js:50` | Baseline determinístico de projeção de saldo e arredondamento de compra | Demanda e entrada são eventos previstos pontuais; não chamar saldo calculado de probabilidade de ruptura |
| Calendário | `app/js/maintenance-calendar.js:4`, `:14`, `:15` | Reutilizar validação, dias e exceções onde compatíveis | Hoje exige turno no mesmo dia. Acrescentar calendário versionado com fuso, virada de dia, pausas e múltiplos turnos para exposição |
| Preventivas | `api/services/preventive-scheduler.js:4`, `:65` | Usar cadastros/agenda como entradas de cenários | Função gera ordens: simulação não deve chamá-la nem produzir efeitos operacionais |
| Poisson | `api/services/poisson.js:1`; `app/js/eam-planning-tools.js:20` | Baseline HPP explicitamente identificado e testes de comparação | Separar quantil condicional, intervalo da taxa e previsão com incerteza; tratar zero falhas e taxa variável |
| Unidades de compra | `api/services/purchase-units.js:3`, `:16` | Preservar conversão, embalagem e preço pactuado no handoff aprovado | No worker usar cópia dos fatores do snapshot; a função conectada ao banco fica no fluxo transacional |
| Autorização de material | `api/services/material-authorization.js:1`, `:15` | Revalidar saldo/estado na aprovação de ação | Resultado analítico não concede permissão nem reserva saldo |
| Condição | `app/js/sistema-core.js:568`, `:578`, `:581` | Estudos sobre leituras escalares; atalho para investigação de alerta | Não presumir vibração bruta, áudio ou séries de alta frequência já armazenadas |
| Compras/fornecedores | `api/routes/procurement.js:24`, `:38`, `:68` | Contexto de preço, previsão manual e fornecedores | Tratar recebimentos parciais, pedidos pendentes, moeda e histórico temporal antes de comparar |

### Regra de integração do frontend

Hoje há scripts globais e extensões que envolvem funções existentes. Propor um controlador único `IndustrialAnalytics`, com montagem/desmontagem da tela, escopo de eventos e descarte de gráficos. O ponto de entrada EAM chama o controlador; o controlador usa o cliente API. Não migrar toda a interface para outra stack nesta entrega. Não espalhar processamento científico por handlers de DOM.

No primeiro ciclo, abrir o estúdio em painel ou página dedicada preservando o desenho atual. Links de ativo/ordem enviam somente contexto inicial; o servidor resolve permissões, fontes e período. Ao fechar, remover listeners, cancelar requisições locais quando possível e liberar objetos gráficos. Uma execução já submetida continua no servidor salvo cancelamento explícito.

### Regra de integração do backend

Extrair acesso a dados analíticos por adaptadores com grão declarado. Não repetir grandes consultas das rotas existentes nem consumir HTML como fonte. Serviço operacional continua responsável por alterações. Serviço analítico lê fontes autorizadas, produz snapshots e chama jobs. Reuso de funções puras pode ser direto; reuso de funções com escrita exige separar cálculo e comando numa futura implementação.

## 3. Estrutura futura por responsabilidade

| Local proposto, ainda inexistente | Responsabilidade | Não deve fazer |
|---|---|---|
| `app/js/industrial-analytics.js` | Navegação, estado da tela, permissões visíveis, estudo atual | Calcular modelos definitivos ou autorizar servidor |
| `app/js/analytics-study-builder.js` | Escolher fontes, grão, população, variáveis e revisão de conflitos | Executar expressões arbitrárias do arquivo |
| `app/js/analytics-results.js` | Renderizar resultados tipados, gráficos, diagnósticos e evidências | Usar HTML de worker como conteúdo confiável |
| `api/routes/analytics.js` | Endpoints autenticados, validação, escopo e respostas | Executar estatística pesada dentro da requisição |
| `api/services/analytics/catalog.js` | Registro de métodos, contratos, opções e versões | Escolher método só pelo tipo numérico |
| `api/services/analytics/source-adapters/` | Extrair dados EAM, movimentos e compras com unidade/grão | Cruzar organizações ou inflar registros em joins |
| `api/services/analytics/exposure.js` | Intervalos de operação e disponibilidade com evidência | Transformar horário desconhecido em operação confirmada |
| `api/services/analytics/episodes.js` | Construir vidas/episódios e classificação de eventos | Reiniciar idade automaticamente após qualquer reparo |
| `api/services/analytics/datasets.js` | Versionar, selar, filtrar e registrar proveniência | Alterar snapshot publicado |
| `api/services/analytics/jobs.js` | Fila, idempotência, cancelamento, cotas e entrega | Dar credenciais de produção ao worker |
| `api/services/analytics/decision-handoff.js` | Revalidar ação aprovada no fluxo operacional | Comprar ou criar preventiva durante simulação |
| `analytics-worker/` ou serviço separado | Motor científico com pacotes fixados e runners homologados | Aceitar código Python/R/SQL/JavaScript do usuário |
| `tests/analytics/` | Fixtures científicas, isolamento, integração e regressão | Testar só se resultado “é um número” |

Local do worker é uma decisão futura de distribuição, não uma instalação efetuada. Python é proposta de motor principal; R pode atender métodos específicos após avaliar licença, empacotamento e homologação. Runners distintos compartilham contrato de resultados e identidade de dataset, sem promessa de igualdade bit a bit entre bibliotecas.

## 4. Contratos de dados e construção do estudo

### 4.1 Fonte não é estudo

Uma ordem é uma ação operacional; não necessariamente uma falha. Uma parada pode ter diversos registros sobrepostos. Um componente substituído pode ter sido removido preventivamente. Uma linha de recebimento parcial não é um pedido completo. Cada adaptador declara seu significado e só depois contribui para o estudo.

O estudo contém pergunta, população, janela, unidade de análise, critério de inclusão/exclusão, desfecho, exposição, grupos, covariáveis e método pretendido. O dataset contém a materialização versionada dessas regras. O job contém o método exato, opções, semente, ambiente e limites. O resultado contém números, gráficos tipados, diagnósticos, limitações e artefatos. A decisão contém alternativa escolhida, responsável e justificativa. Manter identidades separadas.

### 4.2 Contratos mínimos

| Objeto | Campos conceituais obrigatórios | Invariantes |
|---|---|---|
| Referência de fonte | organização resolvida pelo servidor, tipo, ID, revisão ou instante de leitura | ID de outra organização nunca retorna conteúdo |
| Episódio | ativo/componente/posição, início, fim, relógio, entrada tardia, evento, motivo de término, fontes | Duração positiva; censura e falha distintas; configuração válida no tempo |
| Exposição | intervalos conhecidos, desconhecidos, calendário/fuso, leituras, correções | União de intervalos, recorte na janela, sem duplo cômputo |
| Série de estoque | material/local/unidade, instante, quantidade, origem, reserva e situação | Não confundir saldo físico com disponível; evitar demanda duplicada |
| Linha de compra | fornecedor/material, emissão, promessa, recebimentos, quantidade aberta, moeda | Pendente preservado; promessa original distinta de revisão posterior |
| Versão de dataset | receita, schema, unidades, hashes de conteúdo, regras, fontes, data de corte | Imutável ao publicar; correção gera nova versão |
| Especificação de análise | método/versão, dataset, parâmetros, grupos, relógio, limites | Opções em lista permitida; parâmetros coerentes com o método |
| Resultado | estimativa, unidade, população, incerteza, diagnósticos, status, advertências | Não convergência impede selo de resultado validado |
| Cenário | baseline, alternativas, custos, recursos, política, hipóteses e sementes | Comparação usa mesmo escopo; nenhuma escrita operacional |

Fatores de conversão e preços usados precisam ser congelados com data e origem. Dados pessoais devem ser minimizados; uma análise de tempos de reparo por equipe não autoriza ranking individual nem exposição nominal sem necessidade e política apropriada.

### 4.3 Receita permitida de transformação

Operações iniciais: selecionar campos; filtrar por categorias/datas autorizadas; converter unidades por tabela aprovada; derivar duração de campos tipados; agrupar; consolidar intervalos; ligar entidades por chaves verificadas; classificar eventos; excluir com motivo; tratar valores ausentes conforme regra declarada. Cada operação ganha versão e trilha. Nada de `eval`, scripts livres ou fórmulas executáveis de importação.

Deduplicação tem três estados: duplicata exata, possível duplicata, registros distintos. Proximidade de data, descrição ou código não basta para fundir ativos. Usuário revisa candidatos e a decisão fica registrada. Uma correção não apaga o registro bruto; altera a interpretação na versão seguinte.

### 4.4 Reconstrução temporal

Recortar todo intervalo que intercepte a janela, e não apenas intervalos inteiramente contidos. Consolidar sobreposição por ativo e por definição de indisponibilidade. Registrar prioridade entre estado operacional, calendário e horímetro. Contraexemplo para homologação: duas paradas de 08h–10h e 09h–11h somam três horas de indisponibilidade, não quatro.

Exposição por horímetro exige monotonicidade e eventos de reset/troca. Diferença negativa vira conflito. Leituras espaçadas não permitem distribuir operação com precisão subdiária sem hipótese. Mostrar intervalo desconhecido e oferecer cenários separados. Disponibilidade operacional usa tempo elegível; MTBF usa definição de falha e exposição compatíveis. MTTR deve especificar tempo ativo de reparo ou restauração total; espera de peças aparece separadamente.

Histórico incompleto não pode ser recuperado por “IA” como fato. A migração retroativa cria registros com proveniência e grau de evidência; lacunas permanecem explícitas. Registrar melhor os eventos a partir da implantação tem valor mesmo quando o passado não suporta modelos complexos.

## 5. API futura e ciclo de execução

Rotas abaixo são contratos propostos, não endpoints implementados.

| Operação | Contrato e comportamento |
|---|---|
| `GET /analytics/catalog` | Métodos habilitados, requisitos, opções, status de homologação e limites |
| `POST /analytics/studies` | Criar rascunho com pergunta e escopo; validar acesso às fontes |
| `POST /analytics/studies/:id/preview` | Resumo limitado de população, qualidade e conflitos; não modelo completo |
| `POST /analytics/studies/:id/publish` | Congelar receita e dataset de forma consistente; retornar versão |
| `POST /analytics/imports` | Receber arquivo em quarentena com cota e autorização; retornar ID |
| `GET /analytics/imports/:id` | Estado, problemas de schema e amostra escapada; sem exibir segredos |
| `POST /analytics/jobs` | Dataset publicado + método permitido + idempotência; retornar 202/job |
| `GET /analytics/jobs/:id` | Estado, etapa, tentativa, mensagem segura; sem ETA inventada |
| `POST /analytics/jobs/:id/cancel` | Solicitar cancelamento; diferenciar aceito de concluído |
| `GET /analytics/results/:id` | Objeto tipado e vínculos para artefatos autorizados |
| `POST /analytics/scenarios` | Congelar alternativas e premissas; criar execução independente |
| `POST /analytics/decisions/:id/handoff` | Ação aprovada, versão e chave idempotente; revalidar mundo atual |

Não confiar em `org_id` vindo do corpo. O servidor resolve organização e escopo; IDs opacos tampouco dispensam autorização. Revalidar acesso ao baixar artefatos e ao compartilhar relatórios. Cache de resultados deve incluir organização, permissões relevantes e versão do conteúdo.

Estados do job: recebido, validando, enfileirado, executando, publicando, concluído; saídas alternativas rejeitado, falhou, cancelamento solicitado e cancelado. Worker só publica se detiver lease válido e o job ainda aceitar resultado. Reexecução após timeout não cria dois resultados publicados. Cancelamento remove execução quando possível e impede publicação tardia; a trilha permanece.

Um hash garante integridade de bytes, não validade estatística nem anonimização. O fingerprint reprodutível deve incluir receita, dataset, runner, pacotes, opções, relógio e sementes. Datas de download de fontes e versões de bibliotecas entram na auditoria científica.

## 6. Segurança incorporada ao desenho

CSV e JSON não executam comandos por natureza; a vulnerabilidade surge quando a aplicação interpreta conteúdo como código, SQL, HTML, fórmulas ou caminhos, ou quando um parser vulnerável é explorado. Bloquear o caminho de execução: tipos e schemas explícitos, limites antes/depois da decodificação, parser em processo isolado, nomes internos gerados pelo servidor e dados renderizados como texto.

Quarentena deve ser privada e separada de arquivos públicos. Parser sem acesso de escrita ao app, sem credenciais de banco, sem rede desnecessária e com limites de memória/CPU/tempo. JSON: limitar bytes, profundidade, número de nós e campos; rejeitar chaves perigosas em operações de merge e números inválidos. CSV: limitar linhas, colunas e tamanho de célula; tratar charset/separador; fórmulas ficam texto e exportação exige perfil seguro para cliente-alvo. XLSX é fase posterior por complexidade de ZIP/XML e conteúdo ativo; não aceitar macros.

No projeto, `express.json` antecede a inspeção de conteúdo em `api/server.js:71` e `:75`; portanto, o guard posterior não protege sozinho o custo inicial de parse. O validador de anexos existente atende outro domínio; não tratá-lo como importador estatístico pronto. Modelo aprofundado permanece em `ANALYTICS_SECURITY_MODEL.md`.

Se um arquivo disparar sinal: rejeitar/quarentenar, registrar indicador mínimo seguro, bloquear execução, invalidar sessão se apropriado e seguir resposta a incidente. Não há mecanismo seguro de “transportar hacker” já dentro da aplicação. Honeypot seria projeto separado, sem dados reais e sem comunicação com produção; não está no caminho crítico desta implementação. [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## 7. Entregas completas e sequência de construção

### E0 — Dicionário e baseline auditável

Entregáveis: glossário de falha, parada, reparo, espera, vida, posição e exposição; mapa de tabelas/rotas; amostra anonimizada; fixtures mínimas; lista de incompatibilidades; política de acesso. Responsáveis: domínio de manutenção, dados, backend e segurança. Não depender de interface nova.

Aceite: dois especialistas conseguem reconstruir manualmente a mesma população e explicar divergências. Registrar exceções e decisões. Medir cobertura histórica; não estabelecer porcentagem arbitrária de qualidade como probabilidade de confiança.

### E1 — Livro de exposição e indicadores corrigidos

Entregáveis: serviço puro de intervalos, calendário versionado, classificação de eventos, indicadores com denominador visível, teste de recorte/sobreposição/zero falhas e painel de evidências. Reutiliza entrada de confiabilidade atual; cálculo novo passa por comparação documentada antes de substituir comportamento.

Aceite: janela cruzada, parada aberta, sobreposição, turno noturno, reset de contador, manutenção preventiva e ausência de operação têm resultados explicáveis. Coletar diferenças entre baseline antigo e novo, por definição e por dado; não atribuir tudo a bug.

### E2 — Estudos e snapshots internos

Entregáveis: adaptadores EAM/estoque/compras, builder, receita, publicação imutável, linhagem, autorização e um runner descritivo. Primeiro caminho completo: selecionar ativos → revisar dados → publicar → executar → abrir resultado → consultar fonte.

Aceite: editar cadastro depois não altera versão publicada; nova execução na mesma versão reproduz resultado dentro da tolerância; usuário de outra organização não obtém metadados ou artefatos. Contradições de grão e unidade bloqueiam publicação ou exigem exclusão motivada.

### E3 — Importação isolada

Entregáveis: CSV/JSON, perfil de schema, quarentena, validação, prévia limitada, mapeamento de unidades e entidades, estado de rejeição e limpeza. Perfil inicial deve priorizar fontes com grão claro: leituras escalares, episódios ou movimentos; não importador universal de qualquer dado.

Aceite: arquivo válido não cria entidade automaticamente sem reconciliação; CSV formula, JSON profundo, cabeçalhos repetidos, arquivo gigante, path traversal e dados de outro tenant são tratados sem execução e sem indisponibilizar o serviço. Testes futuros, não executados nesta etapa.

### E4 — Confiabilidade e laboratório estatístico

Entregáveis: KM, Weibull/exponencial/lognormal quando apropriados, reparáveis HPP e métodos adicionais homologados; descritivas, comparação de grupos, regressão e SPC por contrato. Mostrar curva de Gauss como distribuição candidata, não default para todo tempo industrial.

Aceite: fixtures com censura e entrada tardia, parâmetros conhecidos, não convergência e unidades alternativas; validar contra referência independente. Curva da banheira tem modo educativo separado de curva estimada; Weibull de dois parâmetros com hazard monótono não demonstra sozinha as três fases da banheira. [NIST — bathtub](https://www.itl.nist.gov/div898/handbook/apr/section1/apr124.htm).

### E5 — Simulação integrada e decisões

Entregáveis: baseline MRP, demanda intermitente homologada, lead time com pendências, simulação de reparo/estoque/equipes, sensibilidade e comparação de políticas. Reusar `calculateMrp` como baseline em fixtures compatíveis; não esconder diferenças de prioridades, reservas ou granularidade.

Aceite: conservação de material, reprodução por semente, casos sem falhas/sem prazo/sem capacidade, estoque compartilhado, recebimento parcial e cenários extremos. Compra real requer responsável e revalidação transacional; o cenário nunca altera ordens.

### E6 — Extensões avançadas

Entregáveis condicionais: valor de informação, análise causal, otimização com restrições e comparação por configuração. Habilitar por contrato e maturidade dos dados, não por calendário comercial. Um método deve poder permanecer indisponível com explicação e alternativa simples.

Aceite: cada proposta informa hipóteses não observáveis, dados necessários, limite de interpretação e testes de sensibilidade. Diagnóstico de qualidade não prova ausência de viés.

## 8. Handoff operacional sem decisões obsoletas

Fluxo: cenário salvo → revisão humana → intenção de ação → verificação de permissões → atualização de saldo, reservas, preços e calendário → comparação com versão aprovada → aprovação/ajuste → comando operacional transacional → auditoria. Se o mundo mudou materialmente, retornar conflito com resumo; não executar uma quantidade antiga silenciosamente.

Compra usa fatores de unidade atuais e registra snapshot contratual. Material usa regra de autorização existente, sem confundir pedido com aprovação ou baixa. Preventiva aprovada entra no serviço operacional; a simulação apenas apresenta uma agenda alternativa. Chave idempotente impede envio repetido por clique/timeout.

## 9. Plano de validação e métricas

Verificação científica: datasets pequenos calculáveis à mão; benchmarks certificados quando aplicáveis; comparação entre bibliotecas; tolerâncias absolutas/relativas por resultado; censura e agrupamento; mudança de unidade; incerteza e não convergência. Não usar apenas comparativo visual de curvas.

Verificação operacional: estoque conservado, um evento não duplica demanda, autorização respeitada, recebimento parcial reduz quantidade aberta corretamente, cenário sem efeitos externos. Verificação de integração: sessão expirada, cache isolado, perda de worker, duplicidade de entrega, cancelamento e artefato indisponível.

Métricas a instrumentar: tempo até estudo utilizável; conflitos por fonte; proporção de exposição conhecida; jobs por estado; tempo em fila/execução; taxa de falha por método; comparação old/new; cenários revisados versus abandonados; ações invalidadas por mudança de saldo. Evitar declarar ganho de produtividade antes de piloto comparável.

Definir desempenho mediante benchmark: tamanho de dados, hardware, concorrência, método e limite. Não prometer segundos para qualquer análise. Registrar SLO separadamente para prévia, job simples, modelo iterativo e simulação. Limitar resultados gráficos por agregação preservando acesso aos dados autorizados, sem amostragem silenciosa.

## 10. Pendências que antecedem compromisso de prazo

1. Confirmar implantação alvo: desktop local, serviço central ou ambos; recursos e governança mudam.
2. Perfilar amostra real autorizada e anonimizada; confirmar captura de operação, evento e configuração.
3. Determinar fronteira entre organização, unidade e grupo para estudos e relatórios.
4. Escolher versões/licenças exatas de motor e bibliotecas, documentação de distribuição e SBOM.
5. Homologar dicionário com manutenção, suprimentos e estatístico responsável.
6. Definir política de retenção, compartilhamento, correções e revogação de acesso.
7. Estimar esforço após E0/E1; dependências e risco são mais confiáveis agora que datas inventadas.

O backlog detalhado de ferramentas especializadas está em `INDUSTRIAL_TOOLS_V2.md`; diagramas e decisões de infraestrutura em `CONSTRUCTION_ARCHITECTURE_V2.md`; especificação visual adicional em `MOCKUP_GALLERY_V2.md`.
