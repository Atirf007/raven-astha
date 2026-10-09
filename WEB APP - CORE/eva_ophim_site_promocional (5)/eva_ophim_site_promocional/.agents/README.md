# Kit de skills e agentes para Codex CLI/app

Este pacote reorganiza o `.agents.zip` recebido para preservar controles de segurança com menos instruções carregadas em tarefas comuns. Ele contém 7 skills, 3 agentes opcionais e um `AGENTS.md` curto. Nenhuma skill instala scanners ou executa correções externas por conta própria.

## Instalação

Copie o conteúdo desta pasta para a raiz do repositório em que usa Codex:

```text
seu-repositorio/
├── AGENTS.md
├── .agents/skills/...
└── .codex/agents/...
```

Se já existir `AGENTS.md`, integre apenas os acordos que se aplicam ao projeto; não substitua as instruções existentes. Verifique também skills com o mesmo `name` em diretórios pais ou pessoais, pois Codex pode mostrar ambas. Reinicie o Codex se uma alteração não aparecer.

Para instalação pessoal, as skills podem ir em `~/.agents/skills/` e os agentes em `~/.codex/agents/`. O `AGENTS.md` deve ser adaptado às regras reais de cada projeto. A configuração de agentes personalizados em TOML é específica do Codex; não copie esses arquivos para outro runtime sem adaptar o formato.

## Estrutura e roteamento

| Componente | Acione quando | Papel |
|---|---|---|
| `code-review` | revisão geral de PR/diff | achados de corretude, regressão, segurança e cobertura |
| `finish-partial-work` | pedido para concluir funcionalidade inacabada | inventário de lacunas, implementação integral e verificação de cada critério |
| `security-audit` | auditoria de segurança aprofundada solicitada | evidência de ameaça, controles e limites |
| `secure-coding` | implementação cruza limite de confiança | controles relevantes à mudança; referências web/arquivos sob demanda |
| `sql-injection-prevention` | SQL bruto/dinâmico ou ORM raw | separação entre valores e código SQL |
| `secrets-hygiene` | credenciais ou exposição | armazenamento, detecção e resposta |
| `dependency-supply-chain` | pacote novo, atualização ou auditoria | procedência, versões e triagem |
| `change_reviewer` | segunda leitura de mudança complexa | agente de leitura, sem edição |
| `security_auditor` | análise independente de fluxo sensível | agente de leitura, sem edição |
| `dependency_auditor` | triagem independente de pacotes | agente de leitura, sem edição |

Agentes adicionais não são acionados automaticamente por este kit. Use um deles quando a tarefa tiver um recorte independente e a evidência compensar o custo. Os arquivos TOML não fixam modelo nem esforço: herdam as opções da sessão, evitando dependência de um modelo específico. Cada agente declara modo de leitura e recebe instrução para não delegar novamente; opções de permissão escolhidas na sessão principal ainda podem prevalecer sobre o TOML.

Para uma funcionalidade parcial grande, use a skill `finish-partial-work` e informe o comportamento final esperado. Se o trabalho atravessar várias sessões, `/goal` no Codex CLI/app mantém os critérios de conclusão visíveis. Exemplo: “Use `$finish-partial-work` para concluir o fluxo de cadastro. Pronto significa criar conta, validar dados, mostrar erros e permitir login. Verifique cada etapa no projeto e corrija o que falhar.”

## Migração do pacote anterior

| Antes | Agora |
|---|---|
| `code-review` + `code-review-lite` | `code-review`, com um fluxo único |
| `secure-by-default` | `secure-coding` + referências condicionais |
| `sql-injection-prevention` | mantida, com exemplos de placeholders corrigidos |
| `secrets-hygiene` | mantida, com resposta a exposição separada de reescrita de histórico |
| `dependency-supply-chain` | mantida, com auditoria separada de instalação/correção |
| `concise-output` | removida; estilo não precisa de skill por tarefa |
| `context-hygiene` | removida; decisões de sessão dependem do runtime e da tarefa |
| `surgical-code-search` | removida; busca direcionada é capacidade geral do Codex |
| `token-budget-router` | removida; troca de modelo/perfil depende do cliente e da escolha do usuário |

Remova as skills antigas ao instalar esta versão para evitar gatilhos duplicados. Guarde o ZIP antigo como cópia de segurança se precisar comparar comportamentos.

## Qualidade e economia

O ganho de tokens depende das skills que o Codex realmente seleciona, do tamanho do diff e das ferramentas usadas. O [relatório de medição](evals/MEASUREMENT.md) compara o texto potencialmente carregado em cenários explícitos; ele **não** afirma uma redução medida de 80% no consumo total. A [matriz de avaliação](evals/SCENARIOS.md) registra acionamentos esperados, controles de segurança e casos negativos para verificar após instalar em um repositório real.

Para checar a estrutura local, execute `python evals/validate_bundle.py` nesta pasta. A validação estrutural não substitui a avaliação comportamental com tarefas reais.

## Fontes de projeto

- [Documentação OpenAI: skills e descoberta no Codex](https://learn.chatgpt.com/docs/build-skills)
- [Documentação OpenAI: agentes personalizados](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [OpenAI: reavaliar skills e prompts](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
- [OpenAI: trabalho prolongado e critérios de conclusão](https://learn.chatgpt.com/docs/long-running-work)
- [OpenAI: avaliar skills com execuções e métricas](https://developers.openai.com/blog/eval-skills)
- [Especificação Agent Skills no GitHub](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx)
- [OWASP ASVS 5.0 no GitHub](https://github.com/OWASP/ASVS)
