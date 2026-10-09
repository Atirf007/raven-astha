---
name: code-review
description: Revise PRs e diffs para detectar defeitos, regressões e riscos. Auditoria de segurança aprofundada usa security-audit.
---

# Revisão de código

1. Identifique base, objetivo e arquivos alterados. Leia o diff e siga os caminhos afetados até contratos, configuração, chamadas e testes relevantes. Expanda o escopo quando a mudança atravessar módulos ou limites de confiança; não leia o repositório inteiro por padrão.
2. Procure defeitos observáveis: comportamento incorreto, autorização sobre o recurso específico, entrada não confiável chegando a SQL/comandos/HTML, vazamento de dados, concorrência e testes ausentes para um risco novo. Consulte uma skill especializada somente quando o risco aparecer.
3. Para cada achado, confirme caminho de execução, pré-condição e impacto. Inclua arquivo e linha, gravidade, evidência e correção sugerida. Não reporte possibilidade abstrata como vulnerabilidade confirmada.
4. Continue após um achado grave para detectar problemas independentes. Termine após uma passagem completa; amplie ou repita apenas para resolver uma dúvida concreta.

Saída: achados em ordem de gravidade; depois, escopo verificado e limites materiais. Se não houver achados, diga isso sem afirmar que o código inteiro é seguro. Evite comentários apenas de estilo.
