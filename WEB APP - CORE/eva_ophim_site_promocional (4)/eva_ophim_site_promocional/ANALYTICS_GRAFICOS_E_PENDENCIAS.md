# Estúdio web — gráficos e estado verificável

**Continuação em 03/10/2026:** a divergência entre as portas 3000/3001 foi resolvida. O laboratório e a API atualizada estão na porta 3000, com login real conferido no navegador. Instalação local, dados hipotéticos, parser real, observações qualificadas, rascunhos privados, paginação, testes de concorrência e dois backups estão registrados em [LABORATORIO_WEB_2026_10_03.md](LABORATORIO_WEB_2026_10_03.md). O restante deste arquivo preserva o estado de 02/10; suas pendências devem ser lidas com a atualização.

Atualizado em 02/10/2026. Este registro complementa `ANALYTICS_LICENCAS_E_IMPLANTACAO.md`; não declara concluídas todas as ferramentas T01–T12.

## Entregas desta continuação

| Recurso | Entrada e comportamento |
| --- | --- |
| Gauss | Medições: histograma em densidade, curva Normal candidata com média/desvio amostrais e Q–Q. Quantis, ausentes e zeros são preservados. Dispersão zero ou menos de três valores válidos não produz uma curva fictícia. |
| Curva de manutenção por idade | Vidas independentes com duração, falha/censura, unidade e hipóteses declaradas. Faixas configuráveis entre 2 e 20; taxa = falhas / exposição acumulada na faixa. Censuras contribuem até sua retirada. Não impõe formato em U nem converte leituras repetidas em vidas. |
| Banheira educativa | Ilustração separada e expansível, identificada como conceitual, sem parâmetros ajustados, unidade física ou previsão. Não é apresentada como resultado dos equipamentos. |
| Pareto | Novo tipo de dados: perdas por categoria. Seleção de quantidade de ocorrências, horas ou custo em reais. Agrega categorias, ordena contribuições e mostra participação/acumulado em dois eixos. Total zero não inventa percentuais. |
| Publicação e evidência | Os três métodos passam pelos contratos fechados, snapshots imutáveis, fila e worker existentes. Relatórios, inspeção, comparação de versões e exportações preservam categorias, valores, unidade e hashes. CSV protege textos com prefixo de fórmula. |
| Interface | Tema exclusivamente claro; seletor e persistência do tema removidos. Ações primárias, seleção de estudo e suporte do shell usam preto. Tabelas numéricas ficam expansíveis; categorias numerosas têm rolagem própria. Nova execução atualiza histórico/etapas e leva ao resultado, sem reabrir o estudo. |

Pareto admite até 100 categorias distintas e 4.000 registros por versão. Não mistura automaticamente frequência, horas e moeda, não reconcilia paradas sobrepostas nesse contrato externo e não determina causa raiz. Valores são numéricos para análise exploratória; este fluxo não é fechamento contábil.

Para usar: abrir um estudo, **Adicionar dados → Digitar dados**, escolher medições, vidas ou perdas por categoria, conferir e publicar a versão. **Executar análise** oferece somente métodos do grão escolhido. Vidas exigem declarações explícitas; arquivos CSV/JSON continuam atendendo somente aos grãos já implementados e dependem do parser isolado habilitado.

As implementações e SVGs são próprios, sem bibliotecas, imagens ou código de produtos terceiros adicionados. Referências conceituais: [NIST — histograma com Normal e diagnóstico gráfico](https://www.itl.nist.gov/div898/handbook/eda/section4/eda4212.htm), [taxa de falha](https://www.itl.nist.gov/div898/handbook/apr/section1/apr123.htm) e [banheira](https://itl.nist.gov/div898/handbook/apr/section1/apr124.htm). Os gráficos não comprovam hipóteses, adequação de modelo ou autorização operacional.

## Evidência executada

- Suíte conjunta web: **194 testes aprovados**, zero falhas, cancelamentos ou skips. Arquivo: `tests/ui/artifacts/web-integration-test-results.txt`. Depois do ajuste de ordem do histórico, os nove casos de interface afetados passaram novamente.
- Integração separada com **MySQL 8 local descartável, Express, sessões persistidas e worker real: 18 cenários aprovados**. Quatro ativos, três planos, oito leituras, quatro estudos. Resultado: `tests/ui/artifacts/analytics-real-mysql-results.json`.
- Resultados conhecidos: média 28,75 °C e oito observações no histograma; exposição de 90 h dividida em 40/30/10/10 h; Pareto com 14 h, maior categoria de 10 h e acumulado final de 100%. Quantis Normais e massa do histograma conferidos por referências/aritmética independente; escala temporal, limites, textos inertes e CSV exercitados.
- Navegador real no viewport normal e em 390×844: fundo claro, ações pretas, nenhuma opção de tema, gráficos sem coordenadas inválidas e página sem extravasamento horizontal. Janela móvel: conteúdo com clientWidth = scrollWidth = 340. Nova análise enviada pela janela terminou e atualizou o histórico. Nenhum erro/aviso de console na conferência do Estúdio.
- Capturas: `analytics-gauss-light.jpg`, `analytics-pareto-light.jpg`, `analytics-age-hazard-light.jpg` e `analytics-age-dialog-mobile-light.jpg`, em `tests/ui/artifacts/`. A ilustração educativa foi aberta e conferida separadamente.

Nenhum dado sintético foi adicionado à conta real. O ambiente de integração não consulta `api/.env`, não usa o banco de produção e não altera o serviço MySQL instalado. Isso verifica este recorte; não certifica segurança global, cobertura dos intervalos ou adequação científica de qualquer população industrial.

## Pendências preservadas

1. **Instância usada pelo usuário:** a porta 3000 serve o HTML atualizado (200), mas `/api/analytics/catalog` ainda responde 404. A API existente precisa ser atualizada somente depois de resolver DNS/TLS validado, schema e permissões mínimas do banco. O usuário informou não ter acesso administrativo ao banco; não foram relaxadas essas proteções nem executadas migrações no banco existente.
2. **Infraestrutura:** operação real do parser isolado, importação de arquivo no ambiente de destino, instalação central por HTTPS, múltiplos processadores/crash/leases e validação visual do PDF impresso continuam pendentes.
3. **Desenvolvimento do plano amplo:** captura qualificada de operação/falha/reparo, calendários/reset de contadores, adaptadores de episódios/estoque/compras, identidade externa com instrumento/relógio, rascunhos privados e auditoria de correções no servidor, protocolos preditivos e outras ferramentas T01–T12 não estão concluídos. Os três gráficos novos não substituem essas entregas.
4. **Homologação:** revisão estatística e de domínio; bandas/intervalos do estimador por idade, testes de normalidade e modelos/recorrências adicionais não foram implementados nem anunciados como disponíveis.
5. **Limpeza:** os processos dos dois ambientes de teste foram encerrados, com identificação dos executáveis e diretórios próprios. A revisão automática da ferramenta bloqueou a exclusão de `tests/.runtime/mysql-NqvV0x`, sem detalhar a regra; a pasta de dados sintéticos foi preservada. O preview final não tinha entrada interativa disponível; seus processos foram encerrados e `tests/.runtime/mysql-1SmYJp` também ficou preservado. Não tentar contornar o bloqueio ou remover serviços/bancos existentes.

O procedimento de instalação segura continua em `ANALYTICS_INSTALACAO_SEGURA.md`; o procedimento reproduzível dos cenários locais está em `tests/integration/README-analytics.md`.
