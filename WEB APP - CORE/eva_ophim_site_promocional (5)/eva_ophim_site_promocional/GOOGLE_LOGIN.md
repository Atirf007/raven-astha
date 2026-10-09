# Login Google no web app

O login e o cadastro usam Google Identity Services. Uma chave de API não habilita esse serviço: é necessário um **ID de cliente OAuth 2.0 do tipo Aplicativo da Web**, terminado em `.apps.googleusercontent.com`.

1. No Google Cloud, configure a tela de consentimento e crie o cliente OAuth Web.
2. Cadastre as origens JavaScript `http://localhost:3000` e `http://127.0.0.1:3000` para o laboratório. Para produção, cadastre a origem HTTPS real.
3. Configure `GOOGLE_CLIENT_ID` no ambiente do processo da API, antes de iniciar `npm start` em `api/`. Não é necessário client secret para este fluxo de ID token.
4. Reinicie a API. Login e cadastro passam a exibir o botão oficial do Google.

Exemplo PowerShell com valor fictício:

```powershell
$env:GOOGLE_CLIENT_ID = '123456789-exemplo.apps.googleusercontent.com'
npm start
```

O servidor valida assinatura RS256, emissor, audiência, validade, e-mail verificado e nonce de uso único. Usuários novos recebem uma organização própria e seguem para o onboarding; contas existentes mantêm organização e papel. Contas locais não são vinculadas automaticamente apenas pela coincidência de e-mail.

O nonce expira em cinco minutos e fica na memória do processo. Ao reiniciar a API, recarregue a tela de login. Para implantar várias instâncias simultâneas, mova os desafios para armazenamento compartilhado com expiração e consumo atômico.

Verificação: `node --test tests/security/google-oauth.test.js tests/security/auth-session.test.js`. Esses testes usam chaves de teste e banco simulado; não comprovam uma autenticação real no Google. A validação real depende do cliente OAuth e de uma conta autorizada na tela de consentimento.
