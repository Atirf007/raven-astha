# Galeria v3 — seis novas funcionalidades

Conceitos de interface com dados fictícios. Nenhum cálculo ou fluxo operacional foi executado. A especificação em `ESTUDOS_EXTERNOS_VALIDACAO_EXPORTACAO_V3.md` prevalece sobre detalhes estéticos. Prompts em `MOCKUP_PROMPTS_V3.md`.

## 1. Inserção de medições

![Inserção de dados](<C:/Users/ciroe/OneDrive/Área de Trabalho/ASTHA RAVEN - Estudos e Mockups - 2026-09-30/MOCKUP_01_INSERCAO_MANUAL_V3.png>)

Formulário tipado: equipamento, variável, valor, unidade, instante/fuso e instrumento. Tabela identifica origem por linha. Fluxo: escolher objeto → digitar/colar → revisar → salvar rascunho → publicar. Salvar no estudo não altera módulo operacional. Erros: unidade ausente, horário ambíguo, possível repetição e ativo inacessível.

Aceite: original e revisão preservados; vazio não vira zero; selecionar ativo não transforma dado digitado em registro operacional existente. Ajuste visual: para medição nova digitada, aba “Digitação” deve ficar ativa; “Dados do ASTHA” seleciona registros existentes. Outliers exigem revisão contextual, não exclusão automática.

## 2. Importação e mapeamento

![Importação](<C:/Users/ciroe/OneDrive/Área de Trabalho/ASTHA RAVEN - Estudos e Mockups - 2026-09-30/MOCKUP_02_IMPORTACAO_V3.png>)

Prévia preserva cabeçalhos; mapa define tipo/unidade/fuso; reconciliação distingue ativo confirmado, item externo e candidato. Fluxo: quarentena → schema → mapeamento → vínculos → revisão → publicação. Revisar pendências deve estar habilitado diante de conflito; publicação fica bloqueada quando necessário.

Aceite: não executar comandos; preservar originais; não resolver identidade só por nome. Ajuste visual: “mantém atualização com a fonte” significa rastreabilidade, não atualização automática de snapshot publicado. Nova fonte requer versão nova; valores tipados/normalizados são representações derivadas.

## 3. Dados separados de avaliação

![Validação separada](<C:/Users/ciroe/OneDrive/Área de Trabalho/ASTHA RAVEN - Estudos e Mockups - 2026-09-30/MOCKUP_03_VALIDACAO_SEPARADA_V3.png>)

Desenvolvimento, validação e teste reservado são papéis definidos antes de avaliar modelo preditivo. Fluxo: definir tarefa → congelar datasets → escolher separação/métricas → verificar vazamento → salvar protocolo → ajustar → avaliar teste congelado. Não mostrar desempenho antes de execução.

Aceite: registrar datasets, grupos, cortes e uso do teste. Separação temporal e por equipamento depende do objetivo; compartilhar ativos pode ser apropriado para prever o futuro dos mesmos ativos. Ajustes: “Linhas A/B” são grupos, não IDs inequívocos; checkmarks só após verificações reais. Período futuro reservado não equivale a teste já observado. Não impor treino/teste para toda análise descritiva.

## 4. Estudo de item externo

![Estudo livre](<C:/Users/ciroe/OneDrive/Área de Trabalho/ASTHA RAVEN - Estudos e Mockups - 2026-09-30/MOCKUP_04_ESTUDO_EXTERNO_V3.png>)

Estudar bancada, amostra, processo ou máquina sem forçar cadastro operacional. Identidade própria e variáveis tipadas; vínculos a material, lote, ordem ou ativo são opcionais e revisados. Fluxo: identificar → declarar variáveis → inserir → publicar → escolher método elegível.

Aceite: nenhum estoque/OS criado; contexto não funde identidades; mesma segurança/versionamento. Promoção para ativo é comando separado com aprovação técnica. Unidade, relógio e instrumento requerem contrato; existir uma variável não torna qualquer modelo apropriado.

## 5. Integração dos dados ASTHA

![Integração de fontes](<C:/Users/ciroe/OneDrive/Área de Trabalho/ASTHA RAVEN - Estudos e Mockups - 2026-09-30/MOCKUP_05_INTEGRACAO_FONTES_V3.png>)

Fontes prioritárias: ativos/componentes, ordens/paradas, horímetros/condição, estoque/reservas e compras/recebimentos. Medições externas complementam. Centro representa versão materializada, não join universal pronto.

Fluxo: pergunta/grão → fontes autorizadas → relações → fatos consolidados → corte/unidades → publicação. Aceite: várias tarefas/materiais não multiplicam falhas; relações têm cardinalidade e finalidade. Linhas são mapa conceitual, não relações físicas de banco. Checks exigem validação real; usar só fontes pertinentes ao estudo.

## 6. Exportação

![Exportação](<C:/Users/ciroe/OneDrive/Área de Trabalho/ASTHA RAVEN - Estudos e Mockups - 2026-09-30/MOCKUP_06_EXPORTACAO_V3.png>)

Escolher PDF/CSV/JSON/pacote, escopo, diagnósticos, dicionário, manifesto e identificadores. Fluxo: configurar → revisar → gerar artefato privado → baixar autorizado. Não publicar ou enviar automaticamente. Erros: acesso revogado, fonte não exportável, limite de tamanho e formato incompatível.

Aceite: resultado/tabela mesma versão; limitações presentes; sem segredos. Remover nomes não garante anonimização. Perfil CSV trata risco de fórmulas por tipo e cliente-alvo; pacote não inclui executáveis ou autorização permanente. Checkbox de identificadores deve descrever minimização e limites.

## Ajustes adicionais observados

Na integração, “prioridade alta/média/baixa” não é ranking de confiabilidade das fontes; pertinência depende da pergunta. “Última atualização” do dataset deve significar data de publicação daquela versão. A menção visual a organizações autorizadas não habilita cruzamento entre tenants: escopo inicial é a organização e suas unidades autorizadas.

Na exportação, o gerador descreveu pacote como “código, dados e ambiente”. Substituir por “receita, dados autorizados e manifesto do ambiente”; não embutir executáveis ou código livre por padrão. O perfil CSV exige tratamento de fórmula além de separador/charset. Opções específicas de CSV só ficam ativas para formato correspondente. Conteúdo obrigatório de método/limitações não pode ser removido de um relatório científico completo sem sinalizar exportação resumida.

## Regras comuns

Adotar navegação e componentes reais do ASTHA na implementação. Tabelas acessíveis, origem/unidade por texto, teclado/foco previsíveis, revisão acionável e autorização no servidor. Galeria amplia v1/v2, cujos ajustes anteriores permanecem registrados. Nomes, datas e números são fictícios.
