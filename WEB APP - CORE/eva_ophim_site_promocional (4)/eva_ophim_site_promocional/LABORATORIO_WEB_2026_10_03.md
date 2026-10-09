# ASTHA RAVEN — laboratório web e estado verificável

Atualizado em 03/10/2026, após unificação da inicialização web. Este é o estado atual; os relatórios anteriores preservam etapas históricas. O uso local está implementado; este documento não declara concluídas todas as ferramentas T01–T12 nem uma implantação em produção.

## Como acessar

O usuário confirmou que a primeira correção de localização ainda falhava no seu terminal. A diferença exata entre as sessões não foi identificada. Foi preparada uma cópia do **mesmo perfil DPAPI** em `api/.local/local-web.dpapi`, excluída do versionamento e fora das pastas publicadas pelo HTTP. A pasta permite acesso somente ao usuário Windows atual. Se o arquivo da pasta oficial estiver ausente, a inicialização usa essa cópia da instalação; erros de acesso, decifragem ou validação continuam encerrando a inicialização. Nenhum banco ou credencial foi recriado. A ausência do arquivo da pasta do usuário foi simulada no fluxo completo: a cópia da instalação foi selecionada, decifrada e a API atualizada foi reconhecida. Os 113 testes de segurança passaram. Esta verificação é local; o próximo uso no terminal do usuário confirmará se há outra diferença de sessão.

Correção adicional do perfil protegido: a localização agora vem da pasta oficial do usuário informada pelo Windows, sem depender de `LOCALAPPDATA` herdado pelo terminal. O perfil existente foi aberto e decifrado com essa variável incorreta e ausente; o comando completo reutilizou a API atualizada nos dois casos. `npm start` também passou na execução real. A API está operacional na porta 3000. Os 112 testes de segurança passaram (`tests/ui/artifacts/web-startup-security-results.txt`). A proteção DPAPI continua vinculada ao usuário Windows original; outro usuário precisa de um perfil próprio. Esta correção não recriou bancos nem alterou credenciais.

- Aplicação ativa: **http://localhost:3000/app/login.html**; **http://127.0.0.1:3000/app/login.html** é o alias local. Cada origem guarda sua própria sessão; autentique-se no endereço que for usar.
- Conta: **admin@astah.com**, usando a senha de teste informada pelo usuário.
- Organização: **Laboratório ASTHA — dados hipotéticos**. Cadastros e estudos são explicitamente hipotéticos.
- Banco novo: **astha_raven_lab**, 96 tabelas. O `evah_ophim_db` permaneceu legado, sem migração destrutiva. Não foi alterado o banco de outro projeto na segunda instância MySQL.
- Para iniciar novamente: na pasta `api`, executar **npm start**. O comando seleciona explicitamente o perfil local protegido, mesmo se o terminal tiver `ASTHA_WEB_PROFILE=principal` herdado. `npm run start:local` exige esse mesmo perfil. `npm run start:principal` usa explicitamente a configuração principal anterior. Não acrescente `server.js`; a forma antiga `npm start server.js` continua aceita por compatibilidade.
- `npm start` reconhece a API local atualizada em execução, mostra o endereço e termina sem criar outra instância. Se o conteúdo do servidor mudou, informa que a instância precisa ser encerrada/reiniciada. A checagem compara a impressão dos arquivos de código/SQL carregados, sem ler segredos.
- Inicialização: o perfil principal atual usa endereço numérico remoto e é recusado pela validação de identidade TLS. Agora o erro orienta a configurar DNS/certificado, em vez de chamar isso de falha ao carregar o perfil. A configuração principal e seus segredos não foram alterados; não há fallback após falha. `NODE_ENV=production` continua impedindo a inicialização do laboratório.
- Correção de inicialização verificada: `npm start server.js` reutilizou a API local atualizada mesmo com `ASTHA_WEB_PROFILE=principal` herdado; `npm run start:principal` mostrou o diagnóstico correto de DNS/TLS, sem enfraquecer a verificação. Health confirmou `operational`, `local-test` e banco conectado. Os **107 testes de regressão de segurança** passaram, incluindo seleção explícita, argumentos inválidos, bloqueio de laboratório em produção e erros sem exposição de segredos: `tests/ui/artifacts/web-startup-security-results.txt`.

A divergência relatada pelo usuário foi confirmada: o navegador usava a porta 3000, enquanto a entrega anterior atendia em 3001. Nesta continuação, a unificação solicitada substituiu as duas instâncias de teste identificadas por uma única API atualizada, em loopback na porta 3000. A porta 3001 não permanece ativa. O login real no navegador confirmou ativos e estudos nessa origem.

Não há sincronização nem fallback silencioso para o remoto. `api/.env` permaneceu inalterado. Produção continua usando o perfil principal; erros de decifragem/validação do perfil local encerram a inicialização. Sessões da instância principal anterior não são aceitas pelo laboratório: faça login novamente. Dados e permissões do banco principal não foram copiados.

## Dados e integrações entregues

| Conteúdo persistido | Quantidade / comportamento |
| --- | --- |
| Ativos | 7, com linha, bomba, motor subordinado, compressor, esteira, reserva e equipamento sem observação |
| Estoque | 5 materiais, com saldo normal, crítico e zerado |
| Preventivas | 4 planos com tarefas; geração por vencimento e contador; repetição sem duplicar o mesmo vencimento |
| Ordens | 9: seis corretivas hipotéticas e três preventivas |
| Condição | 72 leituras: temperatura, vibração e pressão; unidades e alertas persistidos |
| Observações qualificadas | 7 períodos de operação ou falha/reparo, separados da espera; histórico imutável pelo usuário da API |
| Estúdio | 6 estudos e 13 execuções registradas na conferência final; Gauss/histograma/Q–Q, descritiva, Kaplan–Meier, Weibull 2P, taxa por idade e Pareto |
| Arquivo externo | CSV por Docker real, prévia, mapeamento, hash revisado, publicação idempotente e cálculo pelo worker |
| Rascunhos | Salvamento privado por pessoa/estudo no servidor, recuperação após recarregar, revisão concorrente e descarte do conteúdo; um rascunho hipotético foi deixado na conta de teste |
| Histórico | Consulta paginada de operação/reparo, com cursor conferido contra organização e equipamento; interface permite carregar registros anteriores |

No equipamento LAB-BOMBA-P1, período UTC **03/09/2026 a 03/10/2026**, os registros de teste produzem **711 h observadas de operação, 9 h de parada, três falhas, MTBF de 237 h e MTTR de 1,5 h**. Disponibilidade nesse calendário: **98,75%**. O reparo ativo não inclui a espera; a união de intervalos evita duplicar a mesma parada já registrada em ordem. Cobertura insuficiente, conflito ou ausência de eventos mantém as estimativas correspondentes indisponíveis. Custos de registros duplicados precisam de reconciliação própria; o cálculo temporal não resolve automaticamente a contabilidade.

Os estudos incluem zero medido, valor ausente, dispersão nula e equipamento sem dados. Pareto na versão 1 soma **33 h**, com contribuição final acumulada de 100%. A versão 2 de teste altera somente Rolamento de 14 para 15 h e soma **34 h**; foi publicada e calculada pelo fluxo real do navegador. A comparação mantém os dois totais separados. Vidas de rolamentos são corpos de prova hipotéticos independentes declarados, não leituras repetidas convertidas em vidas. A curva educativa de banheira continua separada dos resultados; o estimador por idade não impõe artificialmente um formato em U.

## Gráficos interativos e atualização web

Os gráficos são SVG construídos a partir dos dados, com seleção por mouse/teclado, consulta dos pontos, zoom de 1×/2×/4× e deslocamento da janela nos gráficos numéricos. Selecionar uma barra ou ponto filtra os registros correspondentes e destaca as marcas relacionadas nos outros gráficos da mesma visualização. Limpar seleção restaura os registros; zoom não perde o filtro. Pareto mantém rolagem horizontal das categorias, seleção das barras e alternância da linha acumulada. Valores completos ficam em tabelas recolhidas.

| Recurso do guia | Estado implementado e limite |
| --- | --- |
| Descritiva | Distribuição acumulada, resumo de cinco números, seleção dos registros, zero e ausência distintos; extremos observados não são uma classificação de outliers |
| Gauss | Histograma, curva candidata e Q–Q ligados aos mesmos registros; não confirma normalidade nem estabilidade |
| Sobrevivência | Kaplan–Meier em degraus, intervalos pontuais disponíveis e população em risco com redução após falha/censura; tabela de risco/falhas/censuras |
| Weibull 2P | Sobrevivência ajustada e Kaplan–Meier sobrepostos, CDF, densidade, hazard e gráfico de probabilidade; legendas alternáveis; curvas derivadas dos parâmetros preservados |
| Curva de manutenção | Taxa observada por faixa de idade e exposição; banheira educativa separada, sem ajuste artificial em U |
| Pareto | Contribuição e percentual acumulado, consulta/seleção das categorias e registros, total por unidade; não mistura horas, custo e frequência |
| Comparar versões | Janela de diferenças e sobreposição de ECDF/Gauss, contribuição por categoria ou Kaplan–Meier; tipo, variável e unidade devem coincidir. Sobrevivência exige declarações explícitas; não há teste de significância ou ajuste multigrupo |
| Editar dados | Copiar versão selecionada explicitamente, editar observações e recalcular prévia local após 300 ms; conferir/publicar gera outra versão, sem sobrescrever a anterior |
| Fonte EAM atual | Prévia de leituras, histograma/Gauss, Q–Q, distribuição acumulada e série temporal; seleção ligada aos registros; até 4.000 leituras e período de até 367 dias |
| Relatório | Gráficos interativos do resultado preservado, revisões atualizadas e acompanhamento opcional das leituras atuais da fonte EAM; manifesto acompanha as revisões |

Atualização da fonte, novas versões/execuções e revisões usa consultas **a cada 15 segundos**, com atualização manual, pausa, suspensão da aba oculta e espera progressiva após erro/429. Não é streaming instantâneo por WebSocket. Dados sem alteração mantêm a visualização e seleção; mudanças da fonte recalculam a prévia atual. Falha de conexão sinaliza que o conteúdo anterior não foi confirmado agora. As consultas da fonte conferem sessão, grupo EAM, organização, equipamento e acesso ao estudo no servidor; não publicam snapshots ou enfileiram cálculos em um temporizador.

O navegador usa o mesmo módulo matemático próprio do worker para prévias exploratórias. Ajustes executados continuam explícitos, versionados e isolados no servidor. Um relatório de evidência pertence à sua execução preservada: o acompanhamento da fonte atual é separado e não reescreve aquela execução ou sua exportação. É necessário publicar/executar outra versão para registrar nova evidência. A impressão oculta controles interativos e a prévia operacional, preservando essa distinção; validação visual do PDF continua pendente.

Os recursos do guia foram adaptados ao tema claro, botões pretos, janelas de edição e contexto lateral do app. Eles não tornam concluídas todas as telas, modelos e ferramentas do pacote original. Permanecem pendentes o painel de cenários de manutenção/sobressalentes, previsão de demanda, políticas e custos integrados de estoque, instrumentos/pipeline ampliados e modelos avançados descritos abaixo. A comparação visual de versões não implementa essas análises.

## Correções encontradas nos testes

- A criação de material encontrou quatro colunas faltantes no schema base; a instalação nova recebeu a correção aditiva.
- Disputas de bloqueio na reclamação de trabalhos por dois processadores recebem até três tentativas limitadas, após rollback. O resultado continua protegido pelo token e validade da concessão de execução.
- Recuperação de concessão expirada, resultado tardio, cancelamento e bloqueio do usuário foram exercitados com MySQL real. Um processador antigo não sobrescreve o resultado do novo.
- Registros qualificados usam literais UTC e projeções UTC explícitas, sem depender da conversão de `Date` do driver. A migração do laboratório conferiu o hash de cada registro antes de normalizar os sete períodos. O legado não recebeu essa migração.
- Backups usam destino SQL qualificado por schema para evitar reutilização de uma operação preparada em outro banco. Valores zero de chaves automáticas são preservados.
- Janela de operação/reparo preserva o formulário após erro, mantém a chave de repetição e descarta respostas de uma abertura anterior. Trocar de equipamento limpa o rascunho do equipamento anterior.
- Leituras de condição têm histórico recolhido, números em português, zero distinto de ausência e rótulos traduzidos. Respostas de outro equipamento não preenchem o painel atual.
- Dados visuais não sensíveis de organização/plano são preservados no perfil do navegador. Isso é apresentação; a autorização continua no servidor.

## Segurança do laboratório

Root foi usado somente na preparação e nas cópias administrativas solicitadas. O servidor usa **astha_lab_web@127.0.0.1**, com senha própria aleatória e sem DDL, concessões globais ou acesso aos backups. Snapshots e observações históricas têm somente SELECT/INSERT para essa conta.

Segredos locais ficam fora do projeto e da raiz web, cifrados por **Windows DPAPI CurrentUser**, com acesso ao diretório restrito ao usuário Windows atual. Não foram gravados no código, no `.env`, nos argumentos de processos ou nos relatórios. A conta de teste recebe hash bcrypt; a política de cadastro normal não foi enfraquecida.

O perfil local admite somente o schema, usuário e portas definidos para o laboratório; a porta selecionada agora é 3000. API e MySQL em loopback. A ausência de TLS nesse caminho local não altera a exigência de TLS validado para o banco remoto ou HTTPS da implantação central.

Rascunhos exigem permissão para o estudo e são separados por pessoa, inclusive entre administradores da mesma organização. Não são snapshots publicados. Há limite de oito rascunhos ativos por pessoa, 4.000 linhas e 2 MiB por rascunho. A revisão cresce após salvar/descartar: uma janela antiga recebe conflito e não sobrescreve dados recentes. O descarte apaga o conteúdo e conserva apenas a revisão para impedir esse conflito de identidade. Runtime tem SELECT/INSERT/UPDATE, sem DELETE nessa tabela.

Entradas têm contratos fechados e queries parametrizadas. Observações conferem organização e ativo sob transação; duplicação de chave com conteúdo diferente e sobreposição retornam conflito. Textos semelhantes a HTML ou SQL permanecem dados, sem execução. Os testes conferem também requisições diretas de outro cliente, não apenas permissões visuais.

O parser recebe dados CSV/JSON simples e executa somente o parser fixo. A imagem oficial Node está fixada por digest: `node@sha256:83f1c388c31fb2e51f7cbd4dea949b96260798c98f206e8e4696bc93bd964e3a`. Contêiner sem rede, sem volumes/segredos, filesystem somente leitura, usuário 65534, capacidades removidas, no-new-privileges, 128 MiB, 32 processos e 0,5 CPU. Cancelamento real foi conferido sem contêiner residual.

Docker Scout registrou **20 achados**, dos quais **8 altos** em pacotes da CLI npm que o parser fixo não importa nem executa. Essa avaliação específica não significa imagem sem vulnerabilidades ou homologação para produção. Inventário completo em `tests/ui/artifacts/parser-alpine-cves.sarif`. A origem foi verificada no [repositório oficial Node Docker](https://github.com/nodejs/docker-node) e na [imagem oficial Node](https://hub.docker.com/_/node/); nenhum pacote npm novo foi adicionado nesta entrega.

## Backups verificados

Os dois schemas finais contêm cópias restauradas a partir da mesma leitura consistente:

1. **astha_raven_backup_a_20261003144124**
2. **astha_raven_backup_b_20261003144124**

Cada um tem **96 tabelas**, incluindo os rascunhos, com DDL, linhas, contagens e SHA-256 do conteúdo conferidos. A conta da aplicação foi testada e não consegue ler essas cópias. Manifesto: `tests/ui/artifacts/local-lab-backups.json`.

As tentativas iniciais incompletas e a dupla anterior à normalização UTC foram preservadas, sem apagar schemas existentes. Somente a dupla acima é a referência verificada daquela captura, anterior à nova versão Pareto desta entrega. Essas cópias estão no mesmo servidor/disco: não protegem contra perda do computador inteiro. Replicação ou cópia externa exige destino próprio.

## Evidência executada

As páginas de WMS e manutenção agora iniciam com o tema claro antes de carregar scripts; a preferência escura antiga e seu botão foram removidos dessas páginas. Botões de operação/reparos usam as mesmas classes do aplicativo. A conferência real incluiu desktop e janela móvel sem transbordamento horizontal.

- **217 testes web aprovados**, sem falhas, cancelamentos ou skips: `tests/ui/artifacts/web-integration-test-results.txt`. Incluem paridade matemática navegador/worker para os seis métodos, filtros ligados, zoom, máximo do histograma, revisão/manifesto, pausa e 429, cópia para edição e hipóteses para comparar sobrevivência.
- **26 cenários com MySQL isolado e worker real aprovados**, incluindo concorrência, recuperação, cancelamento, imutabilidade, segregação, UTC, rascunhos privados, paginação real com 105 registros e fonte ao vivo: uma nona leitura altera a prévia sem alterar as oito observações nem a média de 28,75 da evidência preservada. Outra organização recebe 404 e acesso anônimo recebe 401. Artefato: `tests/ui/artifacts/analytics-real-mysql-results.json`.
- **6 verificações do laboratório pela API real aprovadas**, usando login real e usuário restrito do banco: `tests/ui/artifacts/local-integration-results.json`.
- **6 verificações do parser com Docker real aprovadas**: `tests/ui/artifacts/parser-real-docker-results.json`.
- Cadastros, planos e estudos foram criados pela API, com ritmo limitado para respeitar a proteção de escrita. O login observado no laboratório demorou menos de um segundo nas execuções registradas; isso não é uma garantia de tempo para o banco remoto.
- Navegador real: Gauss, Pareto, painel qualificado e janela de observações. Conferência em desktop 1366×900 e em tela pequena 390×844; sem extravasamento horizontal da página ou da janela. Tema claro e ações pretas.
- Capturas em `tests/ui/artifacts/`: `local-pareto-desktop.jpg`, `local-reliability-desktop.jpg`, `local-lab-gauss.jpg`, `local-lab-mobile.jpg`, `local-observation-dialog-mobile.jpg`.
- Estado e contagens reais: `tests/ui/artifacts/local-lab-status.json`.
- Conferência desta entrega no navegador real: seleção Rolamento → 14 h e um registro; edição → 34 h; publicação da versão 2 e worker real → 34 h; comparação → 33 h/34 h separados; fonte EAM → 32 leituras e três gráficos atuais. Tela 390×844 sem extravasamento horizontal da página; o Pareto rola dentro de sua própria área. Capturas `interactive-pareto-selection.png`, `interactive-draft-recalculated.png`, `interactive-pareto-version2.png`, `interactive-version-comparison.png`, `interactive-pareto-mobile.png` e `interactive-live-source.png`.
- Conferência adicional em **localhost:3000**: login real, sete ativos, quatro planos, estudos habilitados, Pareto de 33 h e rascunho recuperado após reload. Capturas: `unified-assets-loaded.jpg`, `unified-studio-pareto.jpg` e `unified-private-draft-restored.jpg`. `npm start` executado contra a instância antiga e a atual: aviso de desatualização e reutilização correta, respectivamente. Estado de execução/porta em `tests/ui/artifacts/unified-web-runtime.json`.

As pastas preservadas de testes anteriores não foram removidas. Os novos ambientes MySQL descartáveis encerraram seus próprios processos e concluíram a limpeza normal. O servidor do laboratório permanece ativo para uso.

## Pendências do plano maior

1. **Implantação central:** HTTPS, DNS/TLS válido do banco principal, permissões administradas pelo responsável e operação em infraestrutura de destino. O laboratório não resolve a administração do remoto. O acesso local e a API na porta 3000 foram corrigidos.
2. **Captura ampliada:** períodos ainda em andamento, calendário de operação, resets qualificados de contadores, identidade de instrumento/relógio, reconciliação de eventos e correções auditadas. A entrega atual registra períodos concluídos, sem sobrescrever o histórico. A paginação completa do histórico já está disponível.
3. **Outras fontes e fluxo:** adaptadores completos de episódios/estoque/compras para o Estúdio, importação XLSX e impressão PDF validada visualmente. Rascunhos privados, edição como nova versão, prévia durante a edição, leitura atual EAM e acompanhamento de revisões já foram implementados. Streaming por eventos ainda não está implementado; a atualização automática atual é a cada 15 s.
4. **Ferramentas e homologação:** demais ferramentas T01–T12, protocolos preditivos, modelos/recorrências adicionais, bandas de incerteza por idade, testes de normalidade e revisão estatística/de domínio. O painel integrado de cenários de manutenção/sobressalentes e as previsões/políticas/custos de estoque dos mockups continuam pendentes. Os gráficos interativos dos seis métodos, curva de probabilidade Weibull, população em risco, seleção ligada e comparação visual de versões estão implementados; isso não constitui aprovação operacional ou conclusão dos modelos avançados.
5. **Operação:** teste de desligamento forçado do processo/SO e recuperação em múltiplas máquinas; o teste atual reproduz concessão expirada e resultado tardio com estado real do MySQL. Alertas da imagem Docker precisam de tratamento para uma publicação de produção.

O recorte local está utilizável e testado. As pendências acima permanecem explícitas, sem stubs apresentados como funcionalidades concluídas.
