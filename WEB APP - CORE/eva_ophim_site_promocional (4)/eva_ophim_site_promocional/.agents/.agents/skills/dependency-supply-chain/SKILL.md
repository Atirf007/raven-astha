---
name: dependency-supply-chain
description: Adicione, atualize ou audite pacotes e lockfiles. Ignore uso de bibliotecas já instaladas.
---

# Dependências e cadeia de suprimentos

1. Confirme a necessidade do pacote e compare com dependências já presentes. Verifique origem, mantenedores, histórico, nome exato, licença e compatibilidade; popularidade isolada não prova segurança.
2. Leia manifesto e lockfile. Para uma versão nova, confira notas de mudança e impactos transitivos relevantes. Preserve a política de lockfile do projeto.
3. Em **auditoria**, execute apenas verificações de leitura já disponíveis e separe achado, versão afetada, versão corrigida, caminho transitivo e exposição real. Não rode correção automática nem instale scanner como parte de uma inspeção.
4. Em **atualização solicitada**, faça a menor mudança compatível e verifique build ou testes afetados. Registre riscos restantes e versões que não podem ser corrigidas sem decisão de produto.

Não classifique todo alerta alto como explorável sem triagem, nem ignore um alerta por estar em dependência indireta. Referência: [OWASP Vulnerable Dependency Management](https://cheatsheetseries.owasp.org/cheatsheets/Vulnerable_Dependency_Management_Cheat_Sheet.html).
