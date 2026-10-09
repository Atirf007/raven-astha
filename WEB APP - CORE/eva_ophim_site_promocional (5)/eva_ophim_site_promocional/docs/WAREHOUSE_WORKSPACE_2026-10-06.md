# Armazéns, mapas e posições — estado verificável

Atualizado em 06/10/2026. Escopo: web app atual em `app/` e API local em `api/`.

## Entregue

- Primeiro acesso de organização sem armazém direciona ao cadastro de armazém/estoque. O servidor recusa material sem armazém válido.
- Cadastro escolhe sede ou filial corporativa ativa. Um estoque subdividido herda mapa e filial do estoque pai.
- `warehouse_context` vincula os registros existentes de armazém, planta CAD, filial e estoque pai. Um mapa pode conter vários estoques.
- CAD salva no mapa do estoque selecionado. Após salvar, o visualizador seleciona esse mapa automaticamente. A seleção de estoque permanece na URL ao recarregar.
- Prateleiras novas recebem o estoque selecionado no formulário CAD. Códigos de prateleira devem ser únicos no mapa.
- Material oferece seleção de prateleira, nível e posição, com validação no servidor. É permitido material sem posição, mas sempre dentro de um armazém.
- Prateleiras antigas sem vínculo explícito ficam disponíveis somente ao armazém original do mapa.
- Visualizador usa os materiais persistidos de todos os estoques do mesmo mapa, com nível e posição correspondentes. Adicionar material pela prateleira abre o cadastro real de material.
- Tema claro fixo, incluindo preferências/classes antigas; superfícies dos modais opacas e botões principais pretos. CAD usa fundo claro.

## Banco e instalação

Atualização aplicada somente ao laboratório `astha_raven_lab`, sem apagar tabelas. Referências de materiais ausentes ou de armazém de outra organização foram reparadas para o primeiro armazém da própria organização; vínculos válidos foram preservados.

`api/tools/upgrade-warehouse-context.js` exige entrada privada pela stdin e verifica o marcador do laboratório. Cria a tabela de vínculo e concede ao usuário de execução somente operações sobre essa tabela. O provisionamento local também inclui esta atualização. Não executa `migrate.js` nem `database/init.js`.

O banco principal/remoto e os schemas legados não foram alterados nesta etapa. Outro ambiente exige aplicar a atualização aditiva com uma conta administrativa antes de executar esta versão da API.

## Evidência executada

- 40 testes automatizados passaram: `warehouse-workspace`, `tenant-routes`, `map-pipeline` e `cad-visibility`.
- 8 verificações HTTP/MySQL reais passaram na conta de laboratório: autenticação, material criado pela interface, filial, mapa compartilhado, isolamento de prateleiras, posição inválida, materiais de ambos os estoques no mapa e referências desconhecidas.
- Verificação HTTP de leitura repetida após reiniciar a versão final da API: passou.
- Navegador real: criou armazém, prateleira e mapa; abriu automaticamente o mapa salvo; cadastrou material em nível 2/posição 3; recarregou e confirmou essa posição no formulário de edição; verificou os estoques do mapa no modal claro do CAD.
- Primeiro acesso vazio verificado com fixture de UI isolada, sem conexão a banco ou credenciais reais. Redirecionamento do Launchpad ao cadastro confirmado.
- Scripts inline do HTML verificados por compilação JavaScript.

Resultados e capturas estão em `tests/ui/artifacts/warehouse-workspace-tests.txt`, `warehouse-live-results.json`, `warehouse-material-position.png`, `warehouse-shared-map.png` e `warehouse-shelf-light.png`.

Dados hipotéticos mantidos na conta solicitada têm prefixo `TESTE UX`; não representam estoque operacional.

## Limites desta etapa

A exclusão de armazéns/mapas com materiais não faz parte deste pedido; o botão antigo de excluir mapa fica desabilitado para as plantas vinculadas, evitando perda do vínculo. Mapas de referência importados continuam disponíveis como referências. Recursos de outras frentes do projeto não foram revalidados por esta alteração.
