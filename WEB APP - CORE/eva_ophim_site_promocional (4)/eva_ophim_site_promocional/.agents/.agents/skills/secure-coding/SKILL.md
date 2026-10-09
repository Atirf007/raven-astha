---
name: secure-coding
description: Implemente código em limites de confiança, como autenticação, entrada externa, rede, arquivos ou saída web. Ignore edições mecânicas.
---

# Implementação segura

Identifique a entrada, o recurso protegido e o efeito da mudança. Aplique somente os controles relacionados ao fluxo alterado:

- **Identidade e acesso:** valide permissões no servidor para cada recurso; não confie em identificadores ou papéis enviados pelo cliente.
- **Entrada e saída:** use APIs que separam dados de código; escape saída conforme o contexto; valide formato, tamanho e destino de dados externos.
- **Estado e erros:** proteja sessão, operações que mudam estado e limites de abuso conforme o risco; não exponha detalhes internos nem dados sensíveis em respostas ou logs.
- **Dependências e segredos:** use as skills específicas quando a tarefa realmente adicionar pacotes ou lidar com credenciais.

Para rotas web, leia [web.md](references/web.md). Para uploads, arquivos ou comandos, leia [files-and-commands.md](references/files-and-commands.md). Para SQL dinâmico, use a skill `sql-injection-prevention`.

Antes de concluir, confira o caminho afetado e faça a menor verificação que possa detectar uma regressão relevante. Se um controle não se aplica, não crie trabalho ou relatório sobre ele.
