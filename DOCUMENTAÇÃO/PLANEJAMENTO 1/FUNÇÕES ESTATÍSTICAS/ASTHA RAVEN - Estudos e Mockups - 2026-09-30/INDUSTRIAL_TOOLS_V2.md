# Ferramentas industriais além do laboratório estatístico

30/09/2026 · propostas de produto, não funcionalidades implementadas.

## 1. O que significa inovação aqui

Não é possível assegurar que uma ferramenta não exista em nenhum projeto aberto. A pesquisa anterior identificou análise industrial em produtos especializados e funções estatísticas extensas em JASP e bibliotecas. As propostas seguintes combinam métodos conhecidos com os dados e as ações do ASTHA. Diferenciação deve ser testada por tarefa do usuário, não por nome de algoritmo.

Classificação: **base** prepara dados confiáveis; **integração industrial** une contextos normalmente separados; **avançada** exige hipóteses, histórico ou validação adicional. Cada ferramenta precisa de contrato, limitações e alternativa quando os dados não bastam. O catálogo estatístico original continua sendo a matriz dos métodos; este documento especifica produtos construídos sobre eles.

## 2. Doze ferramentas propostas

### T01 — Construtor de populações e episódios industriais · base · E2

**Pergunta:** quais componentes realmente pertencem ao estudo e por quanto tempo foram observados? Usuário: confiabilidade/manutenção. Entradas: instâncias, posições, instalação/remoção, falhas, calendário, horímetros e data de corte. Reuso: histórico de componentes e workspace técnico; completar classificação de evento e relógio.

Construção: escolher grão — vida de componente, episódio de ativo reparável ou observação de condição —; reconciliar identidades; unir eventos em ordem temporal; marcar entrada tardia e censura; separar remoção preventiva, descarte e falha; mostrar exclusões. Componente instalado antes da janela não deve parecer novo no começo do estudo. Entrada tardia requer idade conhecida; se desconhecida, não inventar.

Saída: tabela de episódios, diagrama de observação, contagens por motivo de término e conflitos. Interface: fontes à esquerda, população central e revisão à direita. Aceite: a mesma ordem não cria duas falhas por múltiplas tarefas; uma troca preventiva não vira falha; vida observada e vida total ficam distintas. Risco: cruzamento de histórico incompleto; oferecer estudo só com períodos confirmados.

**Diferencial potencial:** usuário industrial escolhe população com significado, em vez de montar manualmente uma planilha de duração/evento.

### T02 — Livro de exposição e reconciliação de indicadores · base · E1

**Pergunta:** por que disponibilidade ou MTBF mudou? Entradas: janelas operacionais, paradas, contadores e versão da regra. Método: álgebra de intervalos, classificação e agregação, com prioridade de fontes declarada. Reuso: contadores, downtime e calendário; ampliação para calendário temporal e estados desconhecidos.

Saídas: denominador, numerador, períodos excluídos, conflitos e comparação de versões. Interface: selecionar indicador → ver intervalos → abrir registro. Não fornecer uma pontuação opaca de “confiança 98%”; apresentar fração de exposição conhecida e problemas concretos.

Aceite: recortar paradas que atravessam bordas; consolidar overlap; distinguir indisponibilidade por falha e preventiva; excluir horas fora do tempo elegível segundo contrato. Risco: interpretar calendário de planejamento como operação real. Mostrar “exposição por calendário” separado de “horímetro medido”.

### T03 — Estudo por configuração instalada · integração industrial · E4/E6

**Pergunta:** uma revisão de peça, lote ou montagem tem desempenho diferente? Entradas: posição funcional, instância, fabricante/lote/revisão, datas e covariáveis de operação. Reuso: modelo técnico, instalação e snapshots existentes; necessário reconstruir validade no tempo.

Método: KM estratificado, regressão de sobrevivência ou modelos hierárquicos homologados conforme observação e repetição. Comparar exposição e regimes; agrupar dependência por ativo quando necessário. Um lote comprado recentemente pode parecer melhor só porque ainda não teve tempo para falhar.

Saídas: grupos comparáveis, curva por configuração, eventos/censuras, efeito ajustado quando justificável e lista de diferenças de contexto. Interface: árvore de posições e versões → selecionar comparação → revisar fatores. Aceite: revisão atual não altera o grupo de um evento antigo. Risco: atribuição causal indevida; resultado observacional deve indicar associação.

### T04 — Cockpit de manutenção, equipes e sobressalentes · integração industrial · E5

**Pergunta:** qual política reduz custo e indisponibilidade considerando peças e recursos? Entradas: cenário de falhas, tempos de reparo, distribuição de fornecimento, reservas, estoque, equipes, calendário, custos e política preventiva. Reuso: MRP, reservas, unidades e agenda. Dados ainda não capturados precisam ser premissas editáveis, identificadas como tal.

Método: simulação de eventos discretos com replicações e incerteza parametrizada quando suportada. SimPy é candidato para coordenação de processos e recursos; a biblioteca fornece infraestrutura, não um modelo industrial validado pronto. [Documentação SimPy](https://simpy.readthedocs.io/en/latest/index.html).

Separar variabilidade operacional de incerteza dos parâmetros. Fixar sementes para reprodução; para comparar políticas, números aleatórios comuns podem reduzir ruído quando desenho da simulação permitir. Definir horizonte, estado inicial, aquecimento se aplicável e custo de estoque/ruptura/indisponibilidade sem dupla contagem.

Saídas: distribuição de custo, disponibilidade, espera e ruptura; fronteira de alternativas; faixa de erro Monte Carlo distinta de incerteza do modelo. Interface: comparar atual versus políticas alternativas, sem execução automática. Aceite: balanço de material e recursos; caso determinístico reproduz baseline compatível; dependências entre ativos e estoque compartilhado preservadas. Risco: independência falsa entre falhas; cenários de choque comum quando relevantes.

### T05 — Radar de lacunas que mudam decisões · avançada · E6

**Pergunta:** vale mais registrar horímetro, revisar falhas ou medir fornecedor? Entradas: alternativas, função de custo, incerteza e custo de coleta. Etapa simples: sensibilidade por parâmetro e ranking de lacunas cujo intervalo plausível inverte a escolha. Etapa avançada: valor esperado de informação com modelo probabilístico e amostragem externa/interna.

Saída: “a decisão muda se o prazo exceder X” ou “a medição proposta pode reduzir perda esperada”, sempre condicionada ao modelo. Não chamar simples contagem de valores ausentes de valor econômico da informação. Interface: cartões de coleta com responsável, prazo e premissa. Aceite: exercício sintético com decisão conhecida; custo de coleta pode tornar medição desvantajosa. Risco: prior enganoso e computação aninhada cara; versão inicial deve ser análise de sensibilidade, sem selo de VOI.

### T06 — Grafo de evidências e comparação de versões · base · E2

**Pergunta:** de quais registros e regras veio este número? Entradas: fontes, transformações, dataset, job e revisão. Reuso: auditoria operacional e IDs das entidades; adicionar proveniência analítica. O modelo W3C PROV organiza entidades, atividades e agentes, servindo de referência conceitual sem exigir banco de grafos no primeiro ciclo. [W3C PROV](https://www.w3.org/TR/prov-overview/).

Saídas: caminho resultado → método → snapshot → transformações → registros, com responsável e diferença entre versões. Interface: grafo resumido mais tabela acessível e detalhe lateral. Não exibir todo o grafo de uma vez. Acesso à fonte permanece sujeito à permissão, mesmo que o usuário possa ver agregado.

Aceite: cada exclusão tem motivo; alteração de unidade mostra impacto; snapshot antigo permanece íntegro. Risco: tamanho de linhagem linha a linha; usar agrupamento e referências compactas com expansão paginada.

### T07 — Laboratório de censura e registros incompletos · integração industrial · E4

**Pergunta:** a conclusão se sustenta considerando itens ainda operando e períodos desconhecidos? Entradas: censura, janela, motivos de remoção e restrições plausíveis. Método: estimativa adequada à censura observada, diagnóstico de mecanismos e cenários de sensibilidade. Censura informativa não é corrigida por simplesmente marcar uma coluna.

Saídas: análise principal e cenários claramente separados; indicação de quais conclusões mudam. Não imputar falhas futuras como fato nem tratar simulação de término como observação real. Interface: linhas de vida, filtros por motivo e comparação de hipóteses. Aceite: censuras à direita entram corretamente no conjunto em risco; censura intervalar exige método compatível; entrada tardia tratada explicitamente. Risco: precisão aparente com poucos eventos; mostrar falhas observadas e incerteza, não só total de registros.

### T08 — Fornecedor com pedidos pendentes e recebimentos parciais · integração industrial · E5

**Pergunta:** quanto costuma esperar uma peça, incluindo pedidos ainda não entregues? Entradas: promessa original/revisões, quantidades, entregas e corte. Reuso: compras e recebimentos existentes; necessário histórico consistente de promessa e motivo de fechamento.

Método: descritivas e modelos de tempo até recebimento com censura para pendências quando desenho permitir. Definir desfecho: primeira entrega, entrega de fração relevante ou entrega completa. Cancelamento pode competir com recebimento; não removê-lo silenciosamente. Para pedidos parciais, escolher grão linha/lote/quantidade com pesos justificados, evitando contar uma ordem como várias observações independentes.

Saída: prazo observado, pendências, censura, atraso versus compromisso e risco por horizonte. Interface: prazo prometido e realizado lado a lado. Aceite: entregas parciais somam quantidades corretas; mudança de promessa não apaga compromisso original. Risco: mistura de materiais urgentes e normais; estratificar comparabilidade antes de rankear fornecedor.

### T09 — Assistente de comparabilidade e substituição de peças · integração industrial · E3/E6

**Pergunta:** posso juntar dados de dois códigos ou tratar peças como substitutas? Entradas: especificações, fabricante, revisão, posição, unidade, homologação e histórico. Reuso: catálogo de materiais/modelos e fornecedores qualificados. Método inicial: regras explícitas e candidatos de similaridade; confirmação técnica humana.

Saída: equivalência aprovada, candidato ou incompatível; justificativa, validade e contexto. Não decidir equivalência por texto semelhante ou embedding sozinho. Interface: comparação lado a lado e atributos críticos destacados. Aceite: conversão dimensional preservada; equivalente numa posição não implica equivalente em qualquer equipamento. Risco: decisão de segurança de engenharia; analytics só usa equivalências formalizadas.

### T10 — Investigador de padrões de falha contextualizados · avançada · E4/E6

**Pergunta:** que combinações merecem investigação? Entradas: falhas classificadas, condição, ambiente, configuração e operação. Método: exploração, gráficos, modelos interpretáveis e alertas validados temporalmente. Texto livre pode sugerir categoria para revisão; não produzir diagnóstico definitivo.

Saída: padrão, número de episódios independentes, distribuição de exposição, efeito estimado e hipóteses alternativas. Interface: lista de investigações com caminho para fonte. Aceite: dados posteriores à falha não entram como preditores; validação separa ativos/tempo; seleção múltipla é reconhecida. Risco: vazamento de informação e mineração de significâncias; manter exploração e confirmação distintas.

### T11 — Avaliação de intervenção com hipóteses causais · avançada · E6

**Pergunta:** a intervenção melhorou desempenho ou o contexto mudou? Entradas: data de intervenção, comparador, histórico anterior/posterior, carga e fatores de seleção. Métodos possíveis: desenho experimental quando viável, diferença em diferenças com hipóteses verificáveis em parte, séries interrompidas ou modelo causal identificado. Não habilitar todos sem critério.

DoWhy é candidato para explicitar modelo, identificação, estimação e refutação. Testes de refutação/sensibilidade não provam que uma conclusão observacional está correta. [DoWhy — refutação](https://www.pywhy.org/dowhy/v0.14/user_guide/refuting_causal_estimates/index.html).

Saída: estimando definido, efeito condicionado às hipóteses, diagnóstico de comparabilidade e sensibilidade. Interface: diagrama causal editável por papéis autorizados mais linguagem simples. Aceite: ausência de identificação gera estado “não estimável”; intervenção simulada em fixture tem efeito recuperado dentro da tolerância. Risco: confundimento não medido, simultaneidade de mudanças e escolha dos piores ativos para tratamento.

### T12 — Planejador sob restrições e teste de robustez · avançada · E6

**Pergunta:** qual conjunto de tarefas/peças cabe no orçamento e resiste a atrasos? Entradas: recursos, precedências, qualificação, janela, peças, custo e cenários. Reuso: agenda, MRP e autorizações como restrições de negócio. Método: otimização combinatória e simulação de alternativas. OR-Tools é candidato a programação inteira/por restrições e scheduling, não prova de viabilidade operacional sem modelagem. [OR-Tools](https://developers.google.com/optimization/introduction).

Saída: solução viável, objetivo, gap quando disponível, restrições ativas e cenários em que a política falha. Não chamar resultado “ótimo” se terminou por timeout sem prova. Interface: calendário proposto, conflitos e comparação com baseline. Aceite: nenhum recurso duplamente alocado, peças não negativas, tarefas dependentes ordenadas; inviabilidade gera diagnóstico, não agenda inventada. Risco: restrições ausentes; validação por planejador antes do handoff.

## 3. Como recomendar sem impor um método

O recomendador começa pela pergunta e grão. Verifica tipo de variável, relógio, censura, repetição, agrupamento, quantidade de eventos, estabilidade e pressupostos. Retorna opções elegíveis, motivo, pendências e alternativas simples. Tamanho amostral não é um número universal: depende do método, desfecho, parâmetros e desenho.

Três níveis de interface: guiado por pergunta; configurável com opções metodológicas; revisão técnica com contrato e diagnósticos. Opções avançadas não devem permitir desligar controles de autorização ou transformar dado inválido em válido. O usuário pode escolher outro método elegível e a escolha fica no estudo.

Gráficos seguem conteúdo: comparação de tempos censurados → sobrevivência e tabela em risco; distribuição de variável contínua → histograma/ECDF/QQ conforme pergunta; ordem temporal → série; estabilidade → carta adequada ao processo; decisão → alternativas/custo/risco. Não sobrepor Gauss a todo histograma por padrão. Não suavizar sobrevivência em curva decorativa. Banheira educativa leva rótulo de ilustração; curva estimada deve informar método e dados.

## 4. Backlog priorizado e critérios de diferenciação

| Prioridade | Ferramentas | Dependência crítica | Evidência de valor no piloto |
|---|---|---|---|
| P0 | T02, T01, T06 | Semântica e identidade | Usuário explica indicador e reproduz população |
| P1 | T07, T03 | Episódios e configuração temporal | Comparação inclui itens ainda operando e revisões corretas |
| P1 | T08, T04 | Estoque/recebimentos e recursos | Cenário muda decisão com premissas verificáveis |
| P2 | T09, T10 | Homologação técnica e condição | Reduz reconciliação/investigações falsas sem fundir identidades |
| P3 | T05, T11, T12 | Modelo, desenho e maturidade | Medição/intervenção/agenda avaliada por critérios explícitos |

Comparar tarefas com JASP, jamovi, bibliotecas científicas e soluções industriais especializadas: esforço para montar população; tratamento de histórico; explicação de exposição; integração de suprimentos; reprodução; autorização; handoff e custo de operação. Ausência no catálogo público não comprova ausência em plugins, serviços ou versões futuras.

Para reivindicar novidade comercial: definir funcionalidade observável e escopo; registrar versões/data; pesquisar módulos/plugins/repos; consultar usuários; comparar produtos especializados; documentar contraprovas. O discurso seguro por enquanto é “estúdio industrial integrado aos dados do ASTHA”, com capacidades comprovadas por piloto.
