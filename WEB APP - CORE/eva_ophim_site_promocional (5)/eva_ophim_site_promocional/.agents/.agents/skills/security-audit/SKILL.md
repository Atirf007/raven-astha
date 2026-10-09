---
name: security-audit
description: Audite segurança de aplicação ou fluxo quando o usuário pedir avaliação aprofundada; revisão geral de PR usa code-review.
---

# Auditoria de segurança

1. Delimite ativos, superfícies de entrada, identidades, limites de confiança e código relevante ao pedido. Use o [ASVS 5.0](https://owasp.org/projects/asvs) como fonte de requisitos para aplicações web, selecionando apenas controles aplicáveis.
2. Trace cada risco candidato da entrada controlável até o efeito perigoso e verifique os controles existentes. Priorize autorização por objeto, autenticação/sessão, injeção, SSRF, XSS/CSRF, uploads, exposição de dados e configuração conforme o sistema.
3. Separe **confirmado**, **plausível sem prova suficiente** e **não verificado**. Para cada achado confirmado, registre pré-condição, impacto, evidência localizável e mitigação específica.
4. Faça uma passagem de confirmação dos achados. Só repita testes ou buscas quando uma evidência contraditória precisar ser resolvida; registre o limite se a confirmação depender de ambiente externo.

A auditoria é de leitura por padrão. Não instale scanners, altere dependências, rode varreduras externas ou remedeie achados sem que a tarefa inclua essas ações. Uma ferramenta automatizada pode complementar a análise se já estiver disponível; seus alertas exigem triagem.
