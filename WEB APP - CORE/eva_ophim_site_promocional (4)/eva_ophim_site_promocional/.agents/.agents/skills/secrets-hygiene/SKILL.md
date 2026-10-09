---
name: secrets-hygiene
description: Implemente uso de credenciais ou investigue exposição de chave, token, senha ou certificado.
---

# Segredos

- Não grave valores reais em código, exemplos, logs, saídas de ferramentas ou commits. Use armazenamento de segredos apropriado ao ambiente, acesso mínimo e credenciais de curta duração quando disponíveis.
- Exemplos de configuração podem conter nomes de variáveis e valores evidentemente fictícios; não copie credenciais reais para testes.
- Em suspeita de vazamento, não reproduza o valor. Determine onde foi exposto e quem pode acessá-lo; recomende revogação/rotação com prioridade proporcional ao risco. Não execute rotação externa sem autorização para essa ação.
- Varreduras por padrão textual são triagem incompleta. Use scanner já configurado quando disponível e confirme alertas antes de concluir.
- Corrija a fonte da exposição. Reescrita de histórico Git é uma decisão separada: coordene-a porque afeta clones, hashes e integrações; rotação continua necessária mesmo após remover o texto.

Referência: [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html).
