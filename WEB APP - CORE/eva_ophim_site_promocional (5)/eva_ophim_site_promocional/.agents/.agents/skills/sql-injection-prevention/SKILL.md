---
name: sql-injection-prevention
description: Crie ou revise SQL bruto, filtros e ordenação dinâmicos com entrada externa. Ignore mudanças de modelo sem consultas.
---

# Prevenção de injeção em SQL

- Vincule **valores** por parâmetros do driver. Não concatene entrada externa em texto SQL, inclusive dentro de `raw()`, `text()` ou procedimentos armazenados.
- Parâmetros não substituem nomes de tabela/coluna nem direção de ordenação. Mapeie essas escolhas por allowlist fechada definida no código.
- Para listas `IN`, use o mecanismo de expansão do driver/ORM; não junte valores em uma string.
- Confirme a sintaxe do driver antes de copiar exemplos: `sqlite3` usa `?` ou `:nome`; psycopg usa `%s`; PostgreSQL em `node-postgres` usa `$1`; `mysql2` usa `?`.
- Revise o caminho completo da entrada à execução e o escopo de permissões da conta de banco. Validação de formato complementa a parametrização, mas não a substitui.

Ao auditar, relate apenas consultas alcançáveis por entrada controlável e sem separação eficaz entre código e dados. Referência: [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html).
