# Industrial Analytics / Reliability Studio — entrega da pesquisa

**ASTHA RAVEN · 30/09/2026 · coleção ampliada 3.0**

Esta cópia integra a entrega completa na Área de Trabalho. Consulte [COMECE_AQUI](./COMECE_AQUI.md), a [galeria v3](./MOCKUP_GALLERY_V3.md) e o [complemento de inserção/validação/exportação](./ESTUDOS_EXTERNOS_VALIDACAO_EXPORTACAO_V3.md). As seções abaixo preservam a pesquisa e o plano anteriores. São dez imagens no total, além dos wireframes documentais.

## Ampliação: implementação integrada e novas ferramentas

A extensão v2 acrescenta integração com funções reais do app, 12 ferramentas industriais propostas, sete diagramas de construção e três novas imagens. Continua sendo documentação: nenhum código da aplicação foi implementado ou modificado.

| Extensão | Conteúdo |
|---|---|
| [Plano integrado](./IMPLEMENTATION_BLUEPRINT_V2.md) | Reuso com arquivo/linha, módulos futuros, contratos, API, entregas E0–E6 e aceites |
| [12 ferramentas industriais](./INDUSTRIAL_TOOLS_V2.md) | Episódios, exposição, configuração, simulação integrada, evidências, censura, fornecedores e otimização |
| [Arquitetura de construção](./CONSTRUCTION_ARCHITECTURE_V2.md) | Componentes, dados, persistência, importação, jobs, eventos, ações e ADRs |
| [Galeria adicional](./MOCKUP_GALLERY_V2.md) | Três imagens, fluxos, estados, acessibilidade e correções semânticas |
| [Prompts v2](./MOCKUP_PROMPTS_V2.md) | Prompts finais e proveniência da geração |

“Inexistente em todo software aberto” não foi comprovado. O plano propõe diferenciação pela integração industrial e descreve como validar comparação competitiva. Imagens são conceitos fictícios; ajustes necessários antes de implementação estão explícitos na galeria.

Sim: é possível construir um estúdio estatístico nativo que use manutenção, componentes, estoque e compras e guie análises dentro da própria interface. A recomendação é um motor próprio, apoiado por bibliotecas científicas, com datasets semânticos e reprodução, usando o JASP como referência. Paridade com todas as suas opções não é uma promessa desta proposta.

O diferencial potencial é reconhecer significado industrial, censura, exposição, histórico de configuração e decisão operacional. Analytics industrial já existe em produtos concorrentes; a vantagem do ASTHA depende de como essa combinação for entregue e validada com clientes.

CSV/JSON devem permanecer dados. Proteção: importação autenticada, quarentena privada, parser isolado, schema/limites, normalização, worker sem acesso amplo à produção e exportação segura. Honeypot é opcional e separado; não é mecanismo para “mover o hacker” depois de uma invasão.

## Documentos completos

Todos os arquivos estão fora da pasta do projeto. São documentação e imagem; nenhum código da aplicação foi editado.

| Documento | Conteúdo |
|---|---|
| [Pesquisa e diagnóstico](./INDUSTRIAL_ANALYTICS_RESEARCH.md) | Respostas, evidência de código com linha, JASP, licenças, concorrência, 12 casos de uso, riscos e referências |
| [Catálogo estatístico](./STATISTICAL_CAPABILITY_MATRIX.md) | Famílias JASP, contratos, recomendador, Weibull/KM, reparáveis, estatística geral, SPC, estoque e fornecedores |
| [Arquitetura](./INDUSTRIAL_ANALYTICS_ARCHITECTURE.md) | Python/R/JASP/JS, bibliotecas e licenças, jobs, API, deploy, charts, relatórios e reprodução |
| [Modelo de dados](./ANALYTICS_DATA_MODEL.md) | Grão, episódios, variáveis, entidades, qualidade, linhagem, estoque/recebimentos e governança |
| [Modelo de segurança](./ANALYTICS_SECURITY_MODEL.md) | Threat model, CSV/JSON/XLSX, isolamento, tenants, exportação, incidentes e deception |
| [UX e 15 mockups](./ANALYTICS_UX_SPEC.md) | Especificação de telas, imagem conceitual, estados, acessibilidade e exemplos de relatórios |
| [Plano de testes](./ANALYTICS_TEST_PLAN.md) | Golden datasets, tolerâncias, coverage, integração, segurança, desempenho e Definition of Done |
| [Roadmap e handoff](./ANALYTICS_ROADMAP.md) | Fases 0–6, backlog, dependências, ADRs, critérios de aceite e pendências |

Material visual: [Mockup de alta fidelidade](./MOCKUP_RELIABILITY_STUDIO.png) e [prompt/proveniência](./MOCKUP_PROMPT.md). Os 15 mockups funcionais são wireframes documentais; há uma imagem estética adicional, não 15 imagens de alta fidelidade nem um protótipo implementado.

## Conclusões sobre o código existente

Há base operacional aproveitável: componentes, posições, histórico, ordens, paradas, contadores, condição, MRP e compras. Porém, disponibilidade de tabela não demonstra qualidade do histórico. Os cálculos atuais de confiabilidade merecem revisão de exposição por calendário, recorte de paradas, contagem de falhas e denominador de MTTR. O Poisson existente fornece quantil condicional com taxa estimada; não equivale a previsão que incorpora toda a incerteza. Achados e pré-condições constam na pesquisa.

O projeto observado tem testes com asserções e manifestos diferentes de parte da descrição inicial. A proposta se baseia nos arquivos atuais examinados e distingue infraestrutura existente, capacidades desejadas e hipóteses ainda não verificadas.

## Cobertura dos 35 tópicos do briefing

| Tópicos | Local principal |
|---|---|
| 01 resumo; 02 visão; 03 concorrência; 04 JASP; 05 licenças | Pesquisa §§1–5; Arquitetura §3 |
| 06 matriz; 07 confiabilidade; 08 estoque; 09 compras; 10 lab; 11 recomendação | Catálogo §§1–7 |
| 12 UX; 13 telas; 14 mockups; 15 casos de uso | UX §§1–5; Pesquisa §6 |
| 16 dados; 17 motor; 18 alternativas; 19 bibliotecas | Dados §§1–8; Arquitetura §§1–4 |
| 20 segurança; 21 ameaças; 22 sandbox; 23 honeypot | Segurança §§1–8 |
| 24 modelo; 25 reports; 26 charts; 27 reprodução; 28 governança | Dados §§4–9; Arquitetura §§8–9; UX §§6–7 |
| 29 testes; 30 roadmap; 31 DoD; 32 recomendações | Testes §§1–10; Roadmap §§1–12 |
| 33 riscos; 34 perguntas; 35 fontes | Pesquisa §§7–8; Roadmap §13; links junto às decisões |

Há doze diagramas documentais: contexto, arquitetura, dataset, análise, importação, worker, autorização, recomendação, confiabilidade, relatório, modelo de entidades e roadmap. Diagramas são representação de projeto, não infraestrutura criada.

## Limites e pendências materiais

Pesquisa estática com navegação em fontes primárias. O conector de pesquisa aprofundada mencionado não estava disponível; foi usado acesso web direto. Não houve profiling de dados reais, teste dinâmico, execução de API/migração, scanner, build ou implementação. `api/.env` não foi aberto. Arquivos de configuração foram lidos somente onde necessário, sem valores de segredos.

É necessária validação de: versão/release e dependências transitivas; composição de licença; implantação Windows/Linux; volumetria/custo; qualidade de episódios/exposição/recebimentos; hierarquia de autorização; métodos e tolerâncias; UX com pessoas de domínio; vantagem comercial com piloto. Não declarar conformidade com normas industriais cujo texto integral não foi verificado.

**REQUER VALIDAÇÃO JURÍDICA:** integração/distribuição de componentes copyleft, ativos/datasets e políticas de retenção/privacidade. A pesquisa registra essas questões sem assumir permissão comercial irrestrita ou impedimento comercial universal.

## Ordem de leitura sugerida

Começar pela pesquisa; depois catálogo, UX e dados; aprofundar arquitetura/segurança; encerrar com testes e roadmap. Para implementação futura, usar os oito documentos juntos e fechar os ADRs bloqueantes, sem inferir contratos técnicos a partir da imagem.
