# Industrial Analytics / Reliability Studio — pesquisa e diagnóstico

**Produto:** ASTHA RAVEN WMS / EAM / CMMS. **Data:** 30/09/2026. **Natureza:** estudo de produto e engenharia, sem implementação. **Base:** código local e briefing fornecido, com consulta a fontes primárias. Versão documental 1.0.

## 1. Resposta às perguntas centrais

Sim, é possível criar funcionalidades estatísticas nativas, integradas aos dados do sistema, com uma interface mais simples que a de um pacote estatístico geral. Também é possível importar CSV, JSON e, com controles adicionais, XLSX. O trabalho exige construir uma camada semântica dos dados, um catálogo de métodos homologados e uma infraestrutura de execução segura e reproduzível.

Estudar o JASP ajuda a descobrir funções, opções, diagnósticos e padrões de interação. Isso não significa que copiar integralmente seu código seja a melhor estratégia. O programa contém componentes com licenças diferentes, uma interface própria e dependências que precisam ser examinadas individualmente. A recomendação deste estudo é desenvolver a experiência do ASTHA RAVEN e integrar bibliotecas científicas, mantendo o JASP como referência e ferramenta de comparação.

O diferencial potencial é a ligação entre **componente físico → episódio de instalação → exposição → falha/manutenção → estoque → fornecedor → evidência estatística → decisão rastreável**. A simples presença de gráficos e médias já é comum. A vantagem comercial dessa ligação é uma hipótese plausível, ainda dependente de entrevistas, pilotos e resultados medidos; não foi demonstrada por pesquisa de mercado com clientes.

CSV e JSON não executam comandos automaticamente. O risco surge quando dados viram fórmulas, HTML, SQL, argumentos de shell, objetos inseguros ou entrada para um parser vulnerável. A prevenção precisa existir antes e durante o processamento. Detectar um arquivo suspeito não torna possível transferir com segurança um invasor que já comprometeu a produção para um container. O mecanismo recomendado é bloquear, isolar o arquivo/job, preservar evidências e responder ao incidente. Honeypots são um projeto separado.

## 2. Como interpretar este conjunto documental

- **Fato verificado:** observado no código ou sustentado pela fonte indicada.
- **Recomendação:** decisão proposta para este produto; não descreve funcionalidade existente.
- **Alternativa:** opção válida com outros compromissos.
- **Risco:** condição capaz de prejudicar segurança, estatística, operação ou produto.
- **Requer validação:** depende de dados reais, benchmark, versão fechada, especialista ou decisão administrativa.

Nenhum número dos mockups é uma medição do banco real. Não houve acesso ao banco, execução da API, build, migração, instalação de pacote, scanner ou teste de integração. A inspeção é estática. A pasta examinada não respondeu como repositório Git, portanto não há diff Git ou identificação de commit local para esta análise. Os manifestos representam a declaração de dependências, não prova das versões instaladas.

O conector `pesquisa-aprofundada` mencionado não estava disponível nas ferramentas desta sessão. A pesquisa foi realizada com navegação web e consulta direta a documentação, repositórios oficiais e artigos. Links em branches são mutáveis: antes de implementar, registrar tags, commits e hashes dos artefatos efetivamente escolhidos.

## 3. O que o código realmente contém

As referências abaixo usam caminhos relativos à raiz `C:\KazinhoSystems - ArrudaCorp\eva_ophim_site_promocional`. São localizadores da evidência, não cópias completas dos arquivos.

| Área | Evidência no código | Consequência para Analytics |
|---|---|---|
| Desktop | `main.js:11`, `main.js:17`, `main.js:47` | Electron abre a aplicação servida por Express; API iniciada em processo separado. Renderer com integração Node desativada, isolamento e sandbox habilitados |
| API atual | `api/server.js:111`, `api/server.js:122` | Rotas EAM e compras já fazem parte da aplicação; conectar Analytics à identidade existente |
| Frontend carregado | `app/sistema.html:3156`, `app/sistema.html:3161`, `app/sistema.html:3162` | Há scripts globais de EAM efetivamente carregados; não espalhar mudanças futuras pelas cópias legadas |
| Estrutura técnica | `api/database/migrate_eam.js:59`, `api/database/migrate_eam.js:61` | Existem modelos, módulos e posições; falta provar completude do vínculo entre modelo e população física |
| Componentes físicos | `api/database/migrate_eam.js:62`, `api/routes/eam.js:227` | Instâncias têm serial, fabricante, instalação, remoção, estado e contadores; base para episódios de vida |
| Histórico | `api/database/migrate_eam.js:63`, `api/routes/eam.js:307` | Há histórico de instalação, mas listagem limitada não deve virar população analítica truncada |
| Ordens/paradas | `api/database/migrate_eam.js:107`, `api/database/migrate_eam.js:197` | Eventos e custos podem alimentar Pareto, disponibilidade e manutenção |
| Contadores | `api/database/migrate_eam.js:262`, `api/routes/eam.js:431` | Há histórico de horas/ciclos; ainda exige regras para qualidade, cobertura e exposição |
| Condição | `api/database/migrate_eam.js:278`, `api/routes/condition-monitoring.js:47` | Leituras escalares e regras de limites existem; isso não demonstra coleta de formas de onda para análise espectral |
| IoT | `api/server.js:121`, `api/routes/eam.js:454` | Existe superfície de ingestão separada; avaliação estatística precisa preservar origem, unidade e identidade do sensor |
| Compras | `api/database/migrate_eam.js:183`, `api/database/migrate_eam.js:193` | Pedido e recebimento permitem parte da análise de lead time; recebimentos parciais precisam de eventos detalhados |
| Demanda/MRP | `api/database/migrate_eam.js:277`, `api/services/mrp-planner.js:1` | Planejamento determinístico existente deve consumir resultados aprovados, sem ser confundido com previsão probabilística |
| Poisson | `api/services/poisson.js:1`, `api/routes/eam-completion.js:17` | Há cálculo limitado de projeção de eventos; não existe evidência de laboratório estatístico completo |
| Identidade | `api/middleware/auth.js:17`, `api/security/authorization.js:1` | Organização derivada da sessão e papéis existentes; adicionar permissões analíticas explicitamente |
| Grupos/unidades | `api/middleware/groupAccess.js:5`, `api/database/ensure_org_workspace.js:69` | Há grupos e unidades; a hierarquia completa do briefing não deve ser considerada já homologada |
| Testes | `tests/security/`, `tests/integration/eam-completion-db.js:27` | Há testes com asserções e integrações; a instrução antiga de que só existem scripts avulsos está desatualizada frente aos arquivos encontrados |

Os manifestos atuais declaram Electron `44.5.1` na raiz e Express `4.22.3`, diferentemente da descrição inicial de Electron 30. Isso deve orientar a investigação de compatibilidade, mas não confirma instalação nem validação dessas versões.

### 3.1 Achados de correção estatística confirmados pela leitura

**A1 — Exposição de calendário apresentada como operação. Prioridade alta para confiabilidade.** Em `api/routes/eam.js:424` e `api/routes/eam-completion.js:22`, a exposição deriva da duração da janela menos soma das paradas. Pré-condição: equipamento opera por turnos, fica ocioso ou tem exposição parcial. Efeito: a taxa pode ser subestimada e o MTBF superestimado. Recomendação: contador validado ou calendário operacional explícito; estimativa de calendário deve ter rótulo próprio e não ser misturada à exposição medida.

**A2 — Numerador e denominador do MTTR não descrevem a mesma população. Prioridade alta.** Em `api/routes/eam.js:424`, `failures` conta registros de downtime de todos os tipos de ordem da consulta, enquanto `corrective_hours` soma somente corretivas; o MTTR divide estas horas pelo total de registros. Pré-condição: janela contém downtime de ordens preventivas/inspeção ou vários registros para a mesma falha. Efeito: indicador pode cair por aumento de registros que não são reparos corretivos. Recomendação: definir evento de falha, reparo, tempo ativo de reparo e indisponibilidade como conceitos distintos.

**A3 — Paradas que atravessam a janela são excluídas e sobreposições podem ser somadas. Prioridade alta.** Consultas em `api/routes/eam.js:424` e `api/routes/eam-completion.js:21` exigem início e fim dentro do período. Uma parada iniciada antes ou terminada depois não contribui. A escrita em `api/routes/eam.js:417` não demonstra consolidação de intervalos sobrepostos. Efeito condicionado à ocorrência desses dados: disponibilidade e exposição erradas. Recomendação: interseção com a janela, união dos intervalos e regra de hierarquia entre ativo pai e filho. `Math.max(0, ...)` não corrige a causa de exposição negativa.

**A4 — Quantil Poisson condicional não é intervalo completo de previsão. Prioridade média/alta.** `api/services/poisson.js:4` estima a taxa e `:7` procura um quantil da distribuição com essa taxa fixa; `app/js/eam-planning-tools.js:20` apresenta “Cobertura de 95%”. O algoritmo não propaga a incerteza da taxa estimada. O resultado é uma cobertura condicional ao modelo plug-in, não uma garantia de previsão com incerteza de parâmetros. Recomendação: nomear precisamente o quantil, separar IC da taxa e intervalo preditivo e homologar cobertura por simulação.

**A5 — Ausência de falhas tem informação útil, mas o serviço recusa a estimativa. Prioridade média.** `api/services/poisson.js:3` retorna `supported:false` quando não há falhas. Esse comportamento evita falsa certeza, porém pode evoluir para informar exposição e limite unilateral sob modelo explicitado. Não se deve declarar MTBF infinito. O [NIST apresenta o caso de zero falhas](https://www.itl.nist.gov/div898/handbook/apr/section4/apr451.htm).

**A6 — Consumo do material não equivale a consumo daquele equipamento. Prioridade média.** Em `api/routes/eam.js:164`, o vínculo peça/ativo é verificado, mas a agregação seguinte soma saídas do material na organização, sem atribuição ao ativo. Pré-condição: material utilizado em vários ativos. Efeito: série pode ser interpretada como consumo individual indevidamente. Recomendação: rotular como consumo organizacional do item ou construir atribuição por ordem e ativo.

Esses são achados sobre interpretação e cálculo observáveis no código. Não demonstram que dados reais já produziram decisões incorretas.

### 3.2 Controles e limites de segurança observados

Nas rotas examinadas há consultas parametrizadas, verificação de organização e papéis. A sessão é validada no banco, além da assinatura do token. O Electron possui proteções úteis no renderer. Existem limites de corpo e de requisições. Esses controles são bases aproveitáveis, mas não homologam toda a aplicação.

O middleware de grupos em `api/middleware/groupAccess.js:12` preserva acesso legado quando não há grupo atribuído. Isso é comportamento explícito, não prova isolada de invasão. O novo módulo não deve depender desse fallback para conceder importação, exportação e execução de análises.

O `attackGuard` faz inspeção recursiva **depois** de `express.json`, em `api/server.js:71` e `:75`. Portanto seus limites de profundidade/nós não impedem que o parser HTTP já tenha materializado o corpo. Seu padrão de detecção não é fronteira principal e pode identificar textos legítimos como suspeitos. Importações precisam de processamento isolado e limites próprios.

`api/security/attachments.js:1` limita anexos e reconhece formatos existentes, mas não define um pipeline estatístico CSV/JSON/XLSX com quarentena e normalização. Essa infraestrutura terá de ser construída. A CSP em `api/server.js:43` permite scripts inline e determinados CDNs; o relatório técnico futuro merece renderização com política mais restrita e recursos locais. Não foi comprovado um caminho explorável de XSS nesta pesquisa.

## 4. Estudo do JASP e estratégia de aproveitamento

O JASP oferece métodos frequencistas e bayesianos, com módulos especializados. Seu desenho de divulgação progressiva de opções e resultados revisáveis é uma referência útil. O artigo original descreve esses princípios; não prova paridade com as necessidades deste ERP. [Love et al., 2019](https://www.jstatsoft.org/article/view/v088i02).

Os módulos seguem uma estrutura de pacote R, com interface QML e ligação a funções analíticas. Transplantar essa interface para HTML/JS exigiria adaptação substancial. Vale reutilizar o princípio de métodos com contratos e opções declaradas, mantendo uma interface própria. [Estrutura oficial dos módulos](https://github.com/jasp-stats/jasp-desktop/blob/development/Docs/development/jasp-module-structure.md).

**Distinção essencial:** o módulo Reliability trata de consistência/concordância de medições; Survival trata de tempo até evento. Quality Control cobre qualidade de processo. Não mapear o nome “Reliability” automaticamente para falhas de ativos. [Catálogo oficial](https://jasp-stats.org/features/).

### 4.1 Licenciamento: seis situações diferentes

| Situação | Recomendação | Ponto que precisa ser verificado |
|---|---|---|
| Inspiração funcional | Sim | Estudar capacidades; produzir textos, interface e implementação próprios |
| Reimplementação independente | Preferida | Especificação matemática documentada, proveniência e validação numérica |
| Biblioteca também usada pelo JASP | Caso a caso | Licença da biblioteca, versão, dependências e forma de distribuição |
| Incorporação de código de um módulo | Não assumir autorização irrestrita | Copyleft e dependências daquele módulo |
| Embedding do desktop | Não recomendado inicialmente | Integração Qt/Electron, experiência, suporte e obrigações de licença |
| Processo/serviço separado | Alternativa técnica | Separação de processo não resolve, por si só, a classificação jurídica da integração |

**Fato verificado:** a FAQ distingue Engine GPLv2 e Desktop AGPLv3. Os metadados consultados de `jaspSurvival` e `jaspQualityControl` declaram GPL (>= 2). Não existe uma licença única que autorize presumir todos os usos de todos os componentes. [FAQ](https://jasp-stats.org/faq/license-jasp-released/), [Survival DESCRIPTION](https://raw.githubusercontent.com/jasp-stats/jaspSurvival/master/DESCRIPTION), [Quality Control DESCRIPTION](https://raw.githubusercontent.com/jasp-stats/jaspQualityControl/master/DESCRIPTION).

**REQUER VALIDAÇÃO JURÍDICA:** uso comercial é uma questão diferente de manter a distribuição proprietária; GPL/AGPL não são simplesmente licenças “não comerciais”. Distribuição de binários modificados ou obras combinadas pode impor fornecimento de código correspondente. A AGPL também contém obrigação específica relativa à interação remota com uma versão modificada. SaaS não deve ser usado como atalho presumido. A distinção entre programas independentes e obra combinada depende da integração real. [Texto no repositório](https://raw.githubusercontent.com/jasp-stats/jasp-desktop/development/COPYING.txt), [FAQ GNU](https://www.gnu.org/licenses/gpl-faq.en.html).

Para pacote Electron, considerar distribuição ao cliente; para SaaS, considerar execução no servidor e eventual interação com componentes AGPL. Para versões on-premise, examinar imagens e scripts de instalação distribuídos. Assets, ícones, textos, marcas e datasets exigem inventário próprio. O uso de um serviço Python independente com bibliotecas permissivas reduz algumas complexidades, mas não dispensa cumprir avisos e verificar dependências transitivas.

### 4.2 O que não foi concluído sobre o JASP

Esta entrega mapeia famílias funcionais e verifica exemplos industriais centrais. Não é uma auditoria linha a linha de todo o JASP, de todos os módulos e de todos os seus pacotes transitivos. O catálogo pode mudar. Uma promessa de “todas as funções” exige congelar versão e opções, inventariar módulo por módulo e comprovar cada contrato. Não recomendar paridade integral como critério da primeira entrega do ASTHA.

## 5. Análise competitiva sem promessa de exclusividade

| Referência | Capacidade verificada | O que aprender | Hipótese para ASTHA |
|---|---|---|---|
| JASP | Pacote estatístico modular | Opções progressivas, explicações e revisão | Fluxo industrial contextual em vez de partida pela tabela genérica |
| jamovi | Estatística com interface de planilha e base R | Separação UI/métodos | Integração operacional e linhagem de componentes |
| Minitab | Distribuições com censura à direita | Diagnósticos e adequação de distribuição | Reduzir preparo/exportação manual dos registros de manutenção |
| ReliaSoft | Sistemas reparáveis e modelos de confiabilidade | Profundidade industrial e distinção de modelos | Conectar estoque e compras à evidência de vida útil |
| IBM Maximo | EAM/APM, condição e análise preditiva | Ação a partir do contexto do ativo | UX acessível e rastreabilidade de análise para público alvo definido |
| SAP APM | Gestão de risco, confiabilidade e condição | Integração com estratégia de manutenção | Implantação proporcional ao porte e fluxo explicável |
| Odoo | Reposição com lead time e demanda futura | Continuidade com processos de estoque | Acrescentar incerteza e sobressalentes intermitentes |
| Grafana | Fontes, visualização e alertas | Observabilidade e exploração temporal | Evidência estatística com método e snapshot |

Fontes: [jamovi](https://www.jamovi.org/about.html), [Minitab](https://support.minitab.com/en-us/minitab/help-and-how-to/statistical-modeling/reliability/how-to/parametric-distribution-analysis-right-censoring/before-you-start/overview/), [ReliaSoft](https://help.reliasoft.com/reference/reliability_growth_and_repairable_system_analysis/rg_rsa/repairable_systems_analysis.html), [Maximo](https://www.ibm.com/products/maximo), [SAP](https://help.sap.com/docs/sap-apm/1bb12075258a41e1a024d28a6ddfe246/64c6822b3fe044ba874c47430bbd662c.html), [Odoo](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment/report.html), [Grafana](https://grafana.com/docs/grafana/latest/datasources/).

A tabela é comparação conceitual com documentação pública, não teste dos produtos. “Não observado na fonte” não significa “produto não oferece”. Recursos, edições, custos e profundidade não foram medidos comparativamente. A documentação de grandes EAMs confirma que analytics industrial já existe; a hipótese diferenciadora deve se concentrar na combinação e na execução para um segmento específico.

### 5.1 Como comprovar valor comercial

Recomendação de piloto: escolher organizações com equipamentos seriados, registros de falhas e estoque de sobressalentes; incluir técnico, PCM, confiabilidade, almoxarifado e compras. Usar as mesmas tarefas antes/depois: construir população comparável, considerar censura, gerar relatório rastreável e revisar decisão de reposição. Medir tempo para concluir, erros de preparação, rastreabilidade, confiança calibrada, adoção e decisão efetivamente revisada. Comparar com processo atual e software usado pelo cliente, não com concorrente hipotético.

Não usar redução de downtime alegada por outro fornecedor como meta garantida do ASTHA. Mudanças em falhas e custos requerem acompanhamento longitudinal, controle de alterações operacionais e desenho de avaliação adequado.

## 6. Casos de uso completos

### UC01 — Comparar fabricantes de rolamentos

**Ator:** engenheiro de confiabilidade. **Entrada:** episódios de instalação com fabricante, posição, exposição, evento, motivo de saída e contexto. **Fluxo:** partir da posição ou família; revisar grupos; verificar censura e diferenças de carga; congelar snapshot; Kaplan–Meier exploratório; modelo ajustado quando justificável; relatório. **Saída:** curvas, intervalos, população em risco, estimativas em horizontes suportados e limitações. **Ação possível:** abrir investigação de aplicação/lubrificação antes de recomendar fornecedor. **Bloqueios:** vida desconhecida, duplicidade, grupo sem acompanhamento comparável. **Erro a evitar:** declarar fabricante pior por contar somente falhas e ignorar sobreviventes.

### UC02 — Vida de uma família de motores/componentes

**Ator:** PCM/confiabilidade. **Entrada:** população homogênea, marco inicial e tempo medido. **Fluxo:** distinguir primeira falha de recorrências; separar modos; KM; candidatos paramétricos; diagnósticos e sensibilidade. **Saída:** sobrevivência, B10 quando estimável, parâmetros e incerteza. **Ação:** estudar intervalo de inspeção com custos e criticidade. **Bloqueio:** mediana não atingida ou extrapolação forte deve aparecer como tal.

### UC03 — Investigar comportamento de banheira

**Ator:** confiabilidade. **Entrada:** idades, eventos, exposição por faixa e modos de falha. **Fluxo:** montar risco por idade; observar suporte e incerteza; comparar explicações; não impor uma forma ao gráfico. **Saída:** evidência sobre taxa/intensidade e regiões observadas. **Ação:** investigar mortalidade inicial ou desgaste. **Bloqueio:** não existem dados de vida inicial ou tardia; informar a região ausente. O desenho de banheira no briefing tem cauda final descendente; a representação conceitual de desgaste deve subir, e o dado empírico pode não ter formato de banheira.

### UC04 — MTBF, reparo e disponibilidade por planta

**Ator:** gestor/PCM. **Entrada:** calendários, contadores, falhas, reparos e paradas consolidadas. **Fluxo:** harmonizar definição de falha e exposição; comparar por família/criticidade e cobertura; separar indicadores estimados e medidos. **Saída:** numeradores, denominadores, IC quando válido e qualidade. **Ação:** priorizar investigação. **Erro a evitar:** comparar planta 24/7 com planta de um turno como se exposição e mix fossem iguais.

### UC05 — Mudança de downtime

**Ator:** PCM. **Entrada:** intervalos de parada, causa, produção prevista e custos. **Fluxo:** consolidar interseções; série por período; Pareto por horas/custo/frequência; mudança de ponto em fase posterior. **Saída:** tendência e contribuições. **Ação:** revisar recursos, sobressalentes e rotina. **Limite:** aumento de registros pode refletir melhora de coleta, não piora física.

### UC06 — Mudança de vibração

**Ator:** técnico/engenheiro. **Entrada:** valor, unidade, timestamp, sensor, condição operacional e qualidade. **Fluxo:** conferir lacunas, taxa de coleta, mudança de sensor e carga; comparar baseline; SPC apropriado/resíduos; investigar alerta. **Saída:** sinal de mudança com contexto. **Ação:** inspeção confirmatória. **Limite:** anomalia não é diagnóstico de defeito; RMS escalar não substitui espectro ou forma de onda.

### UC07 — Política de sobressalente crítico

**Ator:** planejador de materiais. **Entrada:** demanda atribuída, lead time real, base instalada, criticidade, reservas, pedidos, manutenção prevista e circuito de reparo. **Fluxo:** separar consumo planejado/emergencial; identificar intermitência; backtest; simular demanda no lead time; apresentar cenários. **Saída:** política proposta, risco, investimento e premissas. **Ação:** revisão humana e, somente depois, atualização de política. **Limite:** ausência de saídas durante ruptura não é ausência de necessidade.

### UC08 — Previsibilidade de fornecedor

**Ator:** comprador. **Entrada:** pedidos enviados, promessas versionadas, recebimentos parciais, quantidades aceitas e itens comparáveis. **Fluxo:** definir início/fim do lead time; mostrar mediana e cauda; pedidos abertos separados; ajustar mix. **Saída:** distribuição, OTD/OTIF com denominador e pendências. **Ação:** revisar fonte/quota após considerar criticidade. **Erro a evitar:** média de fornecedor com materiais simples versus média de outro com peças especiais.

### UC09 — Dataset externo de medições

**Ator:** técnico autorizado. **Fluxo:** upload autenticado → quarentena → parser isolado → preview → tipos/unidades → vínculo a ativos no escopo → qualidade → snapshot → análise. **Saída:** dataset independente e linhagem. **Bloqueio:** tipo não permitido, recursos excedidos, schema inválido ou coluna sem interpretação resolvida. Importar dados não modifica ativos automaticamente.

### UC10 — Relatório auditável

**Ator:** engenheiro/revisor. **Fluxo:** executar análise congelada; selecionar resultados; escrever interpretação; revisar limitações; gerar versão; aprovar; publicar para usuários autorizados. **Saída:** relatório e manifesto de reprodução. **Limite:** repetir com dados atuais cria nova execução; não substitui silenciosamente o resultado aprovado.

### UC11 — Revisão de configuração ou intervalo preventivo

**Entrada:** revisões efetivas, população exposta, ordens e contexto ao longo do tempo. **Método inicial:** comparação descritiva segmentada; avançar a modelo longitudinal/causal somente com desenho adequado. **Riscos:** viés de sobrevivência, tempo imortal, alteração simultânea de carga, retrofit aplicado só aos ativos mais problemáticos. **Saída:** associação acompanhada de hipóteses; não prova automática de efeito da revisão.

### UC12 — Gauss e comparação de medições

**Entrada:** medições contínuas com instrumento, unidade e desenho amostral. **Fluxo:** distribuição empírica, Q–Q, contexto de coleta, comparação independente ou pareada conforme o desenho. **Saída:** média/mediana, dispersão, efeito e IC; curva Normal somente como modelo identificado. **Limite:** tempo até falha positivo e assimétrico não deve receber Normal como escolha automática.

## 7. Riscos prioritários e decisões abertas

| Risco | Consequência | Decisão/mitigação |
|---|---|---|
| Vida/exposição sem histórico confiável | Estatística sofisticada sobre dados errados | Corrigir captura e declarar qualidade antes de modelos |
| Populações formadas por joins multiplicadores | Contagens e incerteza falsas | Grão explícito, testes de cardinalidade, agregações separadas |
| Censura informativa por preventiva | Viés de vida útil | Registrar motivo e fazer sensibilidade/modelo apropriado |
| Paridade integral com JASP | Escopo e manutenção excessivos | Catálogo prioritário homologado por etapas |
| Worker com acesso amplo | Movimento lateral/vazamento | Snapshot e identidade de curta duração por job |
| Mistura de tenant nos artefatos/cache | Exposição comercial | Escopo obrigatório em cada estágio e testes negativos |
| Atualização altera resultado histórico | Perda de reprodução | Versão de método, ambiente e pacote persistidos |
| Recomendação sem explicação | Confiança excessiva | Mostrar evidência, pressupostos e alternativas |
| Custo de operação não conhecido | Modelo comercial inviável | Benchmark e cotas antes de SLAs e preços |

Questões a fechar antes da fase 1: SaaS, desktop local ou ambos? Quais volumes e frequência de coleta? Há registros históricos de retirada com motivo e contador? Qual nível de autorização por planta deve ser real? Quem homologa métodos? Há licenças comerciais ou políticas internas de open source? Quais exigências de retenção e residência de dados? Essas perguntas não impediram a especificação, mas condicionam a implementação final.

## 8. Referências científicas e dados de alta fidelidade

Priorizar fontes com autoria, método e procedência; quantidade de dados não equivale a qualidade. O [NIST StRD](https://www.nist.gov/itl/sed/products-services/statistical-reference-data-sets-strd) oferece valores de referência para testes numéricos. Isso valida cálculos específicos, não a aderência do modelo aos ativos do cliente.

O [repositório NASA PCoE](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/) contém conjuntos de prognóstico; o C-MAPSS é gerado por simulação e deve ser identificado como sintético. Dados de bancada, aviação e cliente industrial têm domínios diferentes. Não usar a performance em C-MAPSS como demonstração de RUL confiável em rolamentos do cliente.

Referências consultadas com aplicação delimitada:

1. [Love et al. (2019), JASP, DOI 10.18637/jss.v088.i02](https://www.jstatsoft.org/article/view/v088i02): princípios da interface e implementação estatística.
2. [Virtanen et al. (2020), SciPy, DOI 10.1038/s41592-019-0686-2](https://doi.org/10.1038/s41592-019-0686-2): ecossistema numérico e papel de bibliotecas especializadas.
3. [Jackson (2016), flexsurv, DOI 10.18637/jss.v070.i08](https://www.jstatsoft.org/article/view/v070i08): modelos paramétricos, censura, truncamento e covariáveis.
4. [Teunter, Syntetos e Babai (2011), DOI 10.1016/j.ejor.2011.05.018](https://pure.rug.nl/ws/portalfiles/portal/145394864/Intermittent_demand_Linking_forecasting_to_inventory_obsolescence.pdf): previsão intermitente e obsolescência; motivação para comparar SBA/TSB, não fórmula universal de estoque.
5. [Hyndman e Athanasopoulos, FPP3, séries de contagens](https://otexts.com/fpp3/counts.html): métodos e limites de previsão intermitente.
6. [NIST, confiabilidade](https://www.itl.nist.gov/div898/handbook/apr/apr.htm): definições, modelos, coleta e estimação.
7. [NIST, estabilidade](https://www.itl.nist.gov/div898/handbook/ppc/section4/ppc45.htm): precedência da estabilidade na interpretação da capacidade.
8. [OWASP Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): defesa em camadas para arquivos.
9. [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection): risco na abertura em planilhas e limites de sanitização.
10. [JASP Verification Project](https://jasp-stats.github.io/jasp-verification-project/): exemplo de comparação pública de resultados.

Fontes adicionais e licenças estão junto às decisões nos demais documentos. Não se consultou texto integral de normas industriais pagas; não declarar conformidade com ISO, IEC ou norma setorial sem verificar a edição aplicável e os requisitos completos.
