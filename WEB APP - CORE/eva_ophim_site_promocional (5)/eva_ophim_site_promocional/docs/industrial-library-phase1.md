# Biblioteca industrial — etapa inicial

> Registro histórico da primeira etapa. O estado atual, os testes e o bloqueio de ativação no banco estão em [industrial-library-current.md](industrial-library-current.md). As contagens e pendências abaixo não descrevem a implementação atual.

Referência: especificação ASTHA Factory Design 3D V1.0 fornecida em 08/10/2026. O pedido desta etapa é iniciar a implementação; o checklist integral do PDF permanece como destino do projeto.

## Entrega

14 novos tipos procedurais, além dos 9 existentes: fresadora universal, furadeira de coluna, serra de fita, tanque agitado, silo, braço robótico de seis eixos, SCARA, roletes livres, roletes motorizados, AGV, compressor de parafuso, bomba centrífuga, extintor e cerca de proteção. São representações genéricas ilustrativas, sem especificações de fabricante ou validação de conformidade.

Biblioteca lateral recolhível com pesquisa por nome/código/categoria/tags, normalização de acentos, filtro de categoria, favoritos e recentes locais. Miniaturas produzidas pela mesma geometria dos renderizadores, com câmera e iluminação padronizadas; um único contexto WebGL reutilizado e cache de imagens. Importação existente preservada.

Manifestos têm ID estável, versão, categoria, dimensões padrão em metros, origem e capacidades declaradas. Instâncias continuam nos arrays `machines`/`forklifts` do blueprint existente, com `machineType`, `modelId` e `modelVersion`; posição, medidas e pavimento seguem o contrato canônico atual em centímetros. Não migrou a unidade dos mapas existentes. As medidas efetivas da instância são `w`, `h`, `height3d`, evitando duplicar parâmetros que ficariam desatualizados após uma edição.

Inserção: Editor CAD → Biblioteca 3D → Explorar biblioteca → escolher modelo → clicar na planta 2D. Os dois renderizadores usam a mesma fábrica de geometria. Os comandos de edição, copiar/colar, histórico e salvar existentes continuam responsáveis pelas instâncias.

`app/industrial-library-roadmap.json` registra os 248 IDs/nome/categoria do PDF: 14 implementados e 234 planejados. É inventário de trabalho, separado do catálogo executável; itens planejados não aparecem como botões vazios. Nenhuma migração de banco, dependência ou API foi adicionada.

## Verificação executada

- `node tests/ui/test-object-library.cjs`: 23 IDs únicos, seleção do modelo, referência/versão conservadas na serialização, transformação de medidas/posição/rotação e conferência dos 248 IDs planejados.
- `node tests/ui/test-cad-clipboard.cjs`: cópias independentes, deslocamento e nome exclusivo de prateleira, cancelamento e histórico.
- `node tests/ui/test-shelf-selection.cjs`: mudança de prateleira atualiza grade/foco; compilação dos scripts inline.
- `node --check` nos scripts da biblioteca e painel.
- `tests/ui/industrial-library-preview.html`, navegador com Three.js: 23 geradores em três escalas (0,7×, 1×, 1,4×), bounding boxes com tolerância 0,01 cm e base no piso; busca `robo`, filtro Utilidades industriais, favoritos e seleção. Sem erros/avisos no console durante esses testes.
- Evidência: `tests/ui/artifacts/industrial-library-phase1.png`. Esta é uma página de verificação dos módulos reais, sem sessão autenticada ou chamada ao banco. Não comprova salvar/reabrir via API em ambiente real.

## Próximas etapas e lacunas

1. Completar o lote prioritário de 60 e depois os 208 industriais e 40 complementares, com geometria própria e testes por tipo. Ainda faltam 234 novos tipos.
2. Parâmetros específicos por família, variantes, conectores e encaixe; colisões físicas/áreas de manutenção e footprint 2D específico. O footprint atual é o retângulo dimensional compartilhado. Os manifestos declaram `snap`, `collision`, `connectors` e `assetLink` como falsos nesta etapa.
3. Rebranding integral do workspace e inspetor lateral, árvore completa, camadas/grupos, animações opcionais, LOD/instanciamento e benchmark em máquinas-alvo. A edição CAD atual foi preservada.
4. Vínculos EAM autorizados no backend, documentos, componentes e ordens; importação em quarentena; revisões transacionais, publicação e autosave. Nenhum desses itens foi declarado implementado.
5. Testes autenticados de inserir/salvar/reabrir e integração de API/banco. O teste executado aqui cobre serialização em memória e renderização, sem alterar mapas reais.
