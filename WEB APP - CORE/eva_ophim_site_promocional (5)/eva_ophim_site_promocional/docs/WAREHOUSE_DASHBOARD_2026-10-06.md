# Cadastro, mapas e análises de estoque — 06/10/2026

Implementado no web app atual (`app/` e `api/`).

- Cadastro de armazém: título de 22 px, campos e botão com altura mínima de 44 px, espaçamentos uniformes, tema claro e rolagem em telas pequenas. Prévia oculta até selecionar uma imagem.
- Imagem opcional PNG/JPEG/WebP: compressão no navegador, limite e assinatura raster validados no servidor; capa do mapa compartilhado entre seus estoques.
- Seletores de estoque e mapa em dropdown com nome completo e sede/filial.
- Exclusão recuperável do mapa: esconde o mapa e seus estoques ativos; materiais, planta e histórico preservados. Restauração em “Mapas excluídos”. Controle de organização e função no servidor.
- Launchpad e WMS: gráficos SVG interativos de quantidades movimentadas, valores de entradas/saídas, cadastros por dia e valor atual por estoque. Seleção de um ou vários estoques e intervalo de até 366 dias. Legendas, consulta por teclado e tabelas dos pontos.
- Estoques vazios aparecem na comparação com valores zero. Finalidade e responsável das movimentações exibidos.
- WMS: indicadores, distribuição e ação imediata seguem o filtro de estoques. Launchpad mantém o resumo da organização separado da seção filtrada de análises.
- Atualização automática a cada 30 segundos quando a seção está visível; botão de atualização e filtros consultam novamente. Não utiliza streaming/push.
- Novas entradas/saídas preservam preço e estoque no momento do movimento. Histórico sem registro de preço é identificado como estimativa pelo preço atual. Saída/consumo não equivale a receita; saldo atual não é apresentado como saldo histórico.

## Validação executada

16 testes automatizados passaram: filtros, datas, IDs, isolamento por organização, permissões de exclusão, validação de imagens e regressões de prateleiras/CAD.

4 verificações de integração com API/MySQL local passaram (`tests/ui/artifacts/stock-insights-live.json`): totais reais, filtros inválidos, entrada/saída e exclusão/restauração. Entrada e saída hipotéticas de duas unidades de LAB-MAT-1 deixaram seu saldo inalterado, registrando R$ 251,00 em cada sentido.

Navegador: cadastro com upload e abertura do mapa, imagem persistida no visualizador, exclusão/restauração pelo botão, filtro de um estoque (5 materiais, saldo 58), interação por legenda e teclado. Cadastro sintético adicional “TESTE UX — Cadastro com imagem” mantido disponível, usando captura de planta como capa demonstrativa.

## Implantação e limites

As tabelas adicionais `warehouse_map_meta` e `movement_valuation` foram criadas apenas no schema local `astha_raven_lab`, pelo upgrade aditivo com verificação de propriedade do laboratório. Conta runtime mantém permissões de dados, sem DDL. Banco legado preservado. API local reiniciada.

O banco principal remoto não foi alterado nem validado nesta entrega. Para ativar esses recursos nele, um administrador deve aplicar o upgrade aditivo e conceder as permissões necessárias à conta runtime. Não executar os migradores destrutivos.

A captura de preço desta entrega cobre os endpoints WMS de entrada e saída. Movimentações geradas por outros módulos sem captura usam o fallback explicitamente indicado. Quantidades agregadas somam as quantidades registradas; não convertem unidades distintas.
