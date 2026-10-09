# Medição de instruções

Comparação estática feita com `python evals/measure_instructions.py <pacote-antigo.zip>`. Conta caracteres Unicode dos `SKILL.md` inteiros que os gatilhos **sugerem** para cada cenário, mais o novo `AGENTS.md`. A linha de descoberta conta apenas nomes e descrições das skills. Referências opcionais e agentes não foram acionados nesses cenários.

| Material candidato a carregar | Pacote anterior | Novo kit | Redução |
|---|---:|---:|---:|
| Descoberta de skills | 4.491 | 880 | 80,4% |
| Edição mecânica de código | 13.094 | 615 | 95,3% |
| Concluir interface parcial, sem novo limite de confiança | 13.094 | 2.483 | 81,0% |
| Concluir cadastro parcial com SQL e autenticação | 17.694 | 4.980 | 71,9% |
| Revisão geral de PR | 11.509 | 1.928 | 83,2% |
| SQL dinâmico com entrada externa | 17.694 | 3.112 | 82,4% |
| Atualização de dependência | 15.768 | 1.859 | 88,2% |
| Código com credencial | 16.063 | 3.104 | 80,7% |

Esses números são **redução de texto de instrução potencialmente lido**, não tokens cobrados nem tempo de execução. A seleção implícita de skills pode variar entre tarefas e modelos. Saídas de ferramentas, código lido, raciocínio, cache e eventual uso de subagentes também afetam o consumo. Portanto, a promessa anterior de reduzir **pelo menos 80% do consumo total** não está demonstrada. O cenário de cadastro cai para 71,9% nesta métrica porque precisa carregar instruções adicionais para concluir o fluxo com segurança; não removi esses controles para atingir um número.

Para verificar custo e qualidade reais, use a matriz em [SCENARIOS.md](SCENARIOS.md), execute cada prompt no pacote antigo e no novo com mesmo modelo/repositório, capture `usage.input_tokens`, `usage.output_tokens`, comandos e resultado, e compare medianas. Não otimize um caso que reduza tokens às custas de falhas de segurança ou de tarefa incompleta.

Validação executada neste pacote: `validate_bundle.py` passou para 7 skills e 3 agentes; o `quick_validate.py` do Skill Creator passou nas 7 skills. Avaliações comportamentais em repositório real ainda não foram executadas.
