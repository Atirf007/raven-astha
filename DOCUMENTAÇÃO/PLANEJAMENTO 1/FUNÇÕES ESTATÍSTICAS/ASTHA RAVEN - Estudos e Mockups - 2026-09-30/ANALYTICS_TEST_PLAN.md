# Plano de homologação estatística, segurança e operação

**Status:** plano de testes para futura implementação. Nenhum teste deste plano foi executado nesta etapa de pesquisa. Data: 30/09/2026.

## 1. Evidência exigida

Não considerar função pronta porque desenha um gráfico. Cada método precisa de contrato, dados de referência, estimador/parametrização definidos, diagnósticos e critérios mensuráveis. Comparação com JASP/R só é válida com defaults e entrada harmonizados. Duas bibliotecas que compartilham algoritmo/dependência não oferecem validação totalmente independente.

A homologação deve ser assinada por responsável estatístico e pelo domínio industrial. A segurança e a infraestrutura possuem aceite próprio. Separar validade numérica, validade estatística e utilidade operacional.

## 2. Golden datasets e referência

| Família | Dados e referência | Verificações |
|---|---|---|
| Descritiva | Pequenos conjuntos analíticos e NIST StRD | n/ausentes, `ddof`, quantil, unidade e estabilidade numérica |
| Regressão | StRD, inclusive casos mal condicionados | Coeficientes, resíduos, erro e singularidade |
| Distribuições | Valores analíticos e SciPy/R com parametrização alinhada | PDF/CDF/quantis, limites e caudas |
| KM | Pequena tabela manual com censura/empates; R survival | Degraus, risco, IC e mediana não atingida |
| Weibull 2P | Dados simulados conhecidos e exemplos de referência | MLE censurada, parâmetros, B10, convergência, coverage |
| Cox/AFT | Dados controlados e duas implementações com opções harmonizadas | Efeitos, empates, cluster, entrada tardia e diagnóstico |
| HPP/Poisson | Soluções analíticas e casos do NIST | Taxa, quantil condicional, IC, zero eventos e horizonte |
| Reparáveis | Eventos cumulativos com tendência conhecida | ROCOF, PLP, intervalo de observação e restauro |
| SPC | Baseline estável/alterado e subgrupos definidos | Limites, taxa de falso alarme e regras |
| Estoque | Séries com zero/intermitência/ruptura; demanda simulada | Backtest, viés e serviço de política |
| Fornecedor | Pedidos completos/parciais/abertos e promessas alteradas | Denominadores, censura e timestamps |
| Condição | Sinais/séries conhecidos e dados externos identificados | Qualidade, lacunas, drift e alarmes |

[NIST StRD](https://www.nist.gov/itl/sed/products-services/statistical-reference-data-sets-strd) serve a problemas numéricos específicos. [NASA PCoE](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/) fornece dados para estudos de prognóstico, inclusive simulações; distinguir origem e domínio. [JASP Verification](https://jasp-stats.github.io/jasp-verification-project/) é referência de metodologia comparativa, não homologação automática do ASTHA.

Cada fixture registra licença/procedência, hash, variáveis, unidades, cenário, esperado, software/versão, tolerância, motivo e responsável. Dados reais de clientes precisam de permissão, minimização e ambiente segregado.

## 3. Tolerâncias e propriedades

Não usar igualdade textual de floating point. Definir por método tolerância absoluta/relativa, escala e condição; um ponto de partida como 1e-8 não deve ser aplicado universalmente. Ajustes mal condicionados, extremos e otimização exigem justificativa própria. Testar probabilidades dentro de [0,1], monotonicidade de CDF, não aumento de KM, coerência de intervalos e tipos de dados.

Se reordenar linhas independentes, resultado deve permanecer equivalente; se converter horas para minutos, parâmetros dimensionais devem transformar corretamente e probabilidades permanecer equivalentes. Remover censuras não é transformação invariável. Duplicar episódios também não deve ser aceito como simples aumento legítimo de informação sem verificação de identidade.

Coverage de IC/PI: simulações com população e seed conhecidos em diferentes n/eventos/censuras. Registrar erro Monte Carlo; não homologar cobertura por uma única simulação. Testar viés e regiões fora do contrato. Métodos experimentais ficam identificados e não produzem ação automática.

## 4. Casos extremos obrigatórios

n = 0/1; valores constantes; ausência total; NaN/Infinity após conversão; números extremos; média zero; quantil não estimável; matriz singular; separação em modelos binários; zero falhas; todas falhas; censura intensa; entrada tardia; censura intervalar incompatível; evento desconhecido; empates; clusters; contadores resetados; intervalos sobrepostos; fronteiras da janela; DST/fusos; unidade trocada; consumo fracionário e ID com precisão alta.

Resultado esperado pode ser recusa explicada, não obrigatoriamente número. Teste que exige “algum gráfico” como sucesso é insuficiente.

## 5. Integração de ponta a ponta

| Fluxo | Critério de aceite |
|---|---|
| ERP → dataset | Grão/cardinalidade preservados; todas as linhas elegíveis; filtros/tenant corretos |
| Dataset → snapshot | Captura consistente, manifesto íntegro, publicação atômica |
| Snapshot → job | Método/versão fixados, idempotência, autorização e quotas |
| Job → resultado | Schema válido, tentativa correta, convergência/warnings preservados |
| Resultado → gráfico | Sem recomputar silenciosamente; axes/IC/tabela coerentes |
| Resultado → relatório | Manifesto e limitações presentes; revisão/autorização reais |
| Ação operacional | Proposta separada da aprovação; referência à evidência |
| Revogação | Bloqueia consulta/export/executar conforme política atual |
| Restore | Banco/objetos recuperados juntos e hashes verificáveis |

Testar cenário com ordens que tenham múltiplos materiais, múltiplas paradas e múltiplos apontamentos de mão de obra. É o caso que revela joins multiplicadores. Construir fixture de parada cruzando o corte e de equipamento em turno: os indicadores devem seguir exposição e disponibilidade definidas.

## 6. Segurança

Matriz de identidades: anônimo; viewer; usuário com leitura de uma planta; executor sem export; importador; revisor; admin; conta revogada. Matriz de objetos: próprio tenant; outro tenant; mesmo tenant fora do escopo; objeto agregado com escopo maior; fornecedor global com transações privadas.

Operações: listar, buscar, preview, criar snapshot, enfileirar, cancelar, ler resultado, abrir chart, drill-down, aprovar, exportar e reprocessar importação. Testar também cache, busca, paginação, mensagens de erro e URL expirada. Um 403 na tela principal não cobre os downloads.

Fixtures hostis: formula CSV e save/reopen; HTML em labels/tooltips/report; JSON profundo e chaves especiais; número/string enorme; cabeçalho duplicado; encoding inválido; arquivo truncado; extensão falsa; XLSX com expansão excessiva, relações externas, macros incompatíveis e XML proibido; caminho traversal; output hostil do worker. Fuzzing em ambiente isolado, com corpus minimizado e limites verificáveis.

Isolamento: parser/worker não alcançam banco produtivo, internet não autorizada, arquivo do host, socket de administração ou objeto de outro job. Limite realmente encerra processos e libera recursos. A tentativa de escape deve usar metodologia controlada, sem varredura de serviços externos ou execução em produção.

## 7. Operação, desempenho e falhas

Perfis sugeridos: 10 mil, 100 mil e 1 milhão de linhas; variar colunas, strings, grupos, eventos e tipos. Medir tempo de extração, fila, parse, preparo, ajuste, export e total; RAM/pico, CPU, disco, artefatos, custo e p95. Usar hardware/runtime registrados. Nenhum volume equivale automaticamente a SLA.

Falhas injetadas: worker morto; fila duplicada; lease expirado; storage indisponível; saída parcial; falta de disco; timeout; revogação durante fila; cancelamento durante ajuste; API reiniciada. Aceite: não publicar resultado inválido, não duplicar ação, não vazamento, recuperar estado e limpar temporários.

Equivalência reprodutível: mesmo snapshot, método/ambiente/parâmetros/seed retorna resultados dentro da tolerância. PDF pode ter bytes diferentes por timestamp; resultado canônico não deve variar sem explicação. Atualização de pacote roda regressão numérica antes de processar novos jobs; históricos mantêm manifesto do ambiente anterior.

## 8. UX e acessibilidade

Tarefas: reconhecer censura; distinguir IC/PI; entender ausência de eventos; identificar que curva é extrapolada; revisar outliers; perceber alerta de dependência; interpretar demanda com ruptura; recuperar job e consultar origem. Testar teclado, leitor de tela, zoom, viewport e distinção sem cores.

Critérios: usuário não interpreta dado fictício como produção; entende limites; não consegue acionar método não elegível; consegue retomar estudo; export e tela mostram a mesma população. Realizar avaliação com pessoas de domínio antes da liberação.

## 9. Suite existente e lacunas

Há arquivos com `node:test`/asserções, como `tests/security/eam-completion-calculations.test.js:1`, e integração de EAM em `tests/integration/eam-completion-db.js`. Não foram executados. Testes estáticos servem a regressões de padrões, mas não comprovam correção numérica, isolamento efetivo, performance ou arquitetura nova.

A futura suíte deve separar contratos, estatística, integração, tenant/authz, segurança de import, isolamento, reprodução, export e UX. Testes com banco usam base descartável; os scripts de migração destrutivos do projeto não devem ser executados em banco existente sem autorização específica.

## 10. Definition of Done por método

- Contrato completo e versão escolhida.
- UI e backend reais; persistência e retorno do job.
- Referência numérica e tolerância justificadas.
- Pressupostos, dados insuficientes e convergência tratados.
- População, exclusões, IC/PI e unidades corretos.
- Autorização por recurso, escopo e export testados.
- Segurança de entradas/saídas e isolamento verificados.
- Snapshot, ambiente e manifesto reproduzíveis.
- Auditoria e observabilidade sem dados sensíveis indevidos.
- Acessibilidade e UX de falha/recovery avaliadas.
- Documentação e limitações disponíveis ao usuário.
- Responsáveis estatístico, domínio e engenharia aprovam evidência.

Essa é a definição para a implementação. A documentação presente é pesquisa concluída, não declaração de funcionalidades homologadas.
