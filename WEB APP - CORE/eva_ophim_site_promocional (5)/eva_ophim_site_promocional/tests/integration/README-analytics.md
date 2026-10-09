# Integração do Estúdio com MySQL descartável

Executar da raiz do projeto, com Node 24+ e os binários oficiais MySQL 8 já instalados. Nenhum pacote, imagem ou servidor é baixado. Dependências existentes em api/node_modules são reutilizadas.

`node tests/integration/analytics-real-mysql.js`

Cria um diretório novo em tests/.runtime, inicializa somente esse datadir sem defaults do serviço, cria usuários/segredos aleatórios em memória e aplica apenas CREATE TABLE do schema local e a migração EAM aditiva nesse banco novo. Nunca executa api/migrate.js/init.js, nunca lê api/.env nem acessa localhost:3000. O serviço MySQL existente não é alterado. API e MySQL escutam somente em loopback, em portas temporárias. Conta runtime sem DDL nem alteração de tabelas científicas imutáveis; SHUTDOWN reservado ao bootstrap desse processo. Identificadores SQL de provisionamento são gerados/validados, não entrada do usuário.

Cenários verificados (25 no resultado de 03/10/2026):

- Quatro ativos, três planos preventivos com tarefas, geração idempotente, corretiva/paradas sobrepostas e contador monotônico.
- Oito leituras com média 28,75 °C, um alerta, ausência diferente de zero, versões concorrentes distintas.
- Gauss com histograma/densidade e Q–Q; taxa por idade com falhas/exposição/censura; Pareto de horas com contribuição acumulada e evidência persistida.
- Kaplan–Meier: S(20 h)=0,5 e mediana=20 h; ajuste Weibull real sem IC fictício quando a amostra não permite.
- Sessão obrigatória, acesso cruzado recusado, UPDATE de snapshot recusado pelo MySQL, evidência vinculada a hash/versão e exportação privada.
- Observação em UTC, publicação repetida concorrente, texto semelhante a SQL/HTML tratado como dado e histórico sem DELETE pelo runtime.
- Dois processadores, recuperação de concessão expirada, resultado tardio, cancelamento durante cálculo, usuário bloqueado e limite de tentativas.
- Rascunhos privados por pessoa, recuperação, revisão concorrente, descarte com revisão preservada e DELETE recusado pelo MySQL.
- Histórico com 105 observações em duas páginas, sem repetição, cursor limitado ao equipamento e à organização.

O resultado executado fica em tests/ui/artifacts/analytics-real-mysql-results.json. Ao terminar, encerra o processo próprio e remove somente seu diretório temporário após verificar o caminho absoluto. Não guardar esse diretório como backup de produção. Fechar o terminal à força pode impedir a limpeza; não encerrar serviços apenas por serem MySQL.

Para inspeção manual: `node tests/integration/analytics-real-mysql.js --preview`. O endereço temporário é mostrado depois dos testes. Esse modo serve apenas o Estúdio com uma sessão sintética de teste; outras páginas retornam ao Estúdio. Não usar login/senha reais nem expor esse servidor na rede. A API continua conferindo o JWT/sessão e o escopo persistido. Digite q seguido de Enter ou Ctrl+C para finalizar normalmente. O servidor de produção e seu banco não são substituídos. Para outro local de binários oficiais, configurar ASTHA_TEST_MYSQL_BIN; sem inventar caminhos para downloads.

Os testes não homologam importação via Docker, todas as rotas operacionais, desempenho de produção, decisões científicas ou ferramentas ainda não implementadas. A instalação central depende do procedimento seguro descrito em ANALYTICS_INSTALACAO_SEGURA.md.

O parser é conferido separadamente por `node tests/integration/parser-real-docker.js`, que exige Docker e a imagem oficial por digest já instalada. O laboratório persistente autorizado foi unificado na porta 3000; `npm start` na pasta `api` seleciona o perfil local protegido já preparado. Suas duas cópias verificadas e os testes HTTP com login estão documentados em `LABORATORIO_WEB_2026_10_03.md`. Não confundir esse laboratório com o servidor temporário `--preview`.
