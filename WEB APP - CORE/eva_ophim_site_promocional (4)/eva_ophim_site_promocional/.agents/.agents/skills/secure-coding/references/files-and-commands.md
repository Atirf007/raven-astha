# Arquivos e comandos

Use esta referência somente quando a mudança processar arquivos externos, caminhos ou comandos.

- **Caminhos:** derive o destino a partir de identificadores controlados pela aplicação. Normalize e confirme que o caminho final fica dentro da raiz permitida; considere links simbólicos e extração de arquivos compactados.
- **Uploads:** limite bytes e quantidade, verifique tipo pelo conteúdo quando relevante, gere nomes próprios e isole armazenamento/serving de conteúdo ativo. Avalie parsers, arquivos compactados e recursos consumidos.
- **Comandos:** prefira APIs da linguagem. Se precisar executar programa externo, passe executável e argumentos como lista, sem shell, e valide valores e opções aceitas.
- **Erros e logs:** não inclua conteúdo sensível, caminhos privados ou comandos completos com credenciais na resposta ao cliente ou em logs comuns.

Verifique o caminho real de entrada até a operação. Escapar uma string não substitui uma API segura.
