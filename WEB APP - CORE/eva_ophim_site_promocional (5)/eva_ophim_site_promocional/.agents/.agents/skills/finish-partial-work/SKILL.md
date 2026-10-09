---
name: finish-partial-work
description: Conclua funcionalidade parcial ou inacabada, do inventário de lacunas à verificação final.
---

# Concluir trabalho parcial

Use quando o pedido for **terminar** uma funcionalidade, fluxo ou módulo já iniciado. Defina “pronto” pelo comportamento solicitado, não pela quantidade de arquivos editados.

1. Delimite o componente pedido e identifique o que já funciona. Busque lacunas nesse escopo: caminhos sem implementação, `TODO`/stubs relevantes, botões ou rotas sem efeito, estados não tratados, integrações interrompidas e critérios de aceite citados pelo usuário. Não transforme um pedido localizado em varredura de todo o projeto.
2. Converta as lacunas em uma lista curta de resultados verificáveis. Inclua as partes necessárias para que o fluxo funcione de ponta a ponta, como interface, API, persistência, validação e erros, somente quando fizerem parte desse fluxo.
3. Implemente todos os itens do escopo antes de encerrar. Não substitua comportamento pedido por mock, placeholder, função vazia, comentário “fazer depois” ou plano de implementação, salvo se o usuário pedir um protótipo.
4. Verifique os critérios com execução, teste existente, build ou inspeção concreta conforme o risco. Corrija falhas causadas pela mudança e confira novamente apenas os itens afetados. Faça uma última busca por lacunas **no componente trabalhado**.
5. Encerre quando cada critério estiver atendido ou quando um bloqueio específico impedir a conclusão. Nesse caso, identifique exatamente o item pendente, a evidência do bloqueio e a decisão ou recurso necessário; não descreva a tarefa como concluída.

Para trabalho grande, mantenha o estado dos critérios visível no plano da tarefa ou em uma lista breve. Não repita inspeções sem nova evidência. Esta skill complementa as skills de segurança quando o fluxo alterado as exigir.
