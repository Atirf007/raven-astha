# CAD web — edição conjunta 2D/3D

Implementado em 06/10/2026.

- O modelo canônico calcula a altura das paredes a partir das prateleiras visíveis, com margem superior, e usa a mesma elevação dos andares nas duas vistas. O visualizador agora posiciona a parede pelo centro da altura, apoiando sua base no piso.
- O Editor CAD possui seleção de objetos existentes e campos para nome, coordenadas, largura/comprimento, profundidade, altura e rotação. O código de prateleira e o estoque não são renomeados ao editar a descrição.
- Comandos Selecionar, Mover, Girar e Redimensionar atuam pelo arraste no 3D. Navegar preserva a câmera orbital. Alterações atualizam o blueprint compartilhado, o desenho 2D e o histórico Undo/Redo. Salvar persiste pelo endpoint de layout existente, com autorização da organização.
- Materiais reais no mapa oferecem Editar material e abrem o formulário existente no estoque correto. Não são removidos apenas da representação JSON.
- Corrigidas as alças 2D de entidades baseadas em endpoints e a atualização atrasada que reabria a grade do visualizador dentro do editor.

## Evidência

43 testes automatizados passaram: `cad-object-editing`, `cad-visibility`, `map-pipeline`, `warehouse-workspace` e `tenant-routes`. A verificação final dos componentes CAD repetiu os 13 testes relacionados com sucesso. Scripts frontend e blocos inline passaram pela verificação de sintaxe.

No navegador, o cadastro hipotético TESTE-R01 foi movido, girado e redimensionado pelo arraste; Undo/Redo funcionaram. Após salvar e recarregar, manteve X=551, Y=652, largura=120, profundidade=48, altura=180 e rotação=20 graus. O material hipotético MERB-00000001 foi atualizado pelo mapa com a marca `TESTE UX — edição pelo mapa`. O mapa original foi somente consultado para comparar parede e prateleiras, sem alterações persistidas nele.

Evidências visuais: `tests/ui/artifacts/cad-object-editor.png` e `cad-wall-height.png`.

O arraste de movimento ocorre no plano do andar selecionado; ele não transfere objetos entre andares. A altura é ajustada pelo campo numérico. As unidades do blueprint são centímetros. Não foram adicionadas bibliotecas, dependências ou mecanismos que executem conteúdo externo.
