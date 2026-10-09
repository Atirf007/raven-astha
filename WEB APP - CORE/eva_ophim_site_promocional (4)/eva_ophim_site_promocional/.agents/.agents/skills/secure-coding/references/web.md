# Fluxos web

Use esta referência somente ao alterar rotas, páginas, sessões ou chamadas de rede.

- **Autorização:** cheque no servidor a ação e o objeto concreto, inclusive em listagens, downloads e atualizações em lote. Teste acesso entre usuários quando o fluxo permitir.
- **Sessão:** use mecanismos do framework para cookies seguros, expiração e regeneração após mudança de privilégio. Não aceite autenticação apenas no frontend.
- **CSRF:** operações com sessão baseada em cookie que mudam estado precisam de defesa adequada ao framework; `SameSite` sozinho pode não cobrir todo o desenho.
- **XSS:** use escape contextual do template/framework. Revise HTML bruto, URLs, atributos e scripts construídos com dados externos.
- **SSRF:** chamadas de servidor para URL controlável por usuário exigem destino permitido, tratamento de redirecionamentos e bloqueio de redes internas quando aplicável.
- **Abuso:** defina limites proporcionais para login, recuperação de conta e operações caras. Mensagens de erro não devem facilitar enumeração de contas quando isso elevar o risco.

Referência: [OWASP ASVS 5.0](https://owasp.org/projects/asvs). Escolha requisitos conforme o contexto; o Top 10 não substitui uma especificação de controles.
