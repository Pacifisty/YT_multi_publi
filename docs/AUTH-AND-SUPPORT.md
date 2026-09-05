# Recuperacao de senha e solicitacoes

## Recuperacao de senha

O fluxo fica disponivel em `/login`, no link **Esqueci minha senha**.

- `POST /auth/password-reset/request` recebe `{ "email": "..." }` e sempre responde de forma neutra para emails validos.
- O token enviado por email possui 32 bytes aleatorios, e armazenado apenas como SHA-256, expira em 30 minutos e aceita um unico uso.
- `POST /auth/password-reset/confirm` recebe `{ "token": "...", "newPassword": "..." }`.
- Depois da alteracao, o usuario recebe uma notificacao e deve entrar normalmente com a nova senha.

O link e montado a partir de `PUBLIC_APP_URL`. Em producao, configure um provedor real em `EMAIL_PROVIDER`, `EMAIL_PROVIDER_API_KEY` e `EMAIL_FROM_ADDRESS`.

## Solicitacoes com protocolo

A central publica fica em `/login#atendimento`; a central autenticada fica em `/workspace/configuracoes`.

- `POST /support/requests`: cria uma solicitacao publica.
- `GET /support/requests/:protocol?key=...`: consulta usando a chave privada de acompanhamento.
- `POST /api/service-requests`: cria uma solicitacao associada a sessao autenticada.
- `GET /api/service-requests`: lista os protocolos da conta autenticada.
- `GET /api/service-requests/:protocol`: consulta um protocolo da conta autenticada.

O protocolo segue o formato `PMP-AAAAMMDD-XXXXXXXXXXXX`. A chave de acompanhamento e retornada apenas na criacao, armazenada somente como hash e enviada por email junto com o link privado. O endpoint publico possui limite de cinco requisicoes por minuto por origem.

Categorias aceitas: `access`, `technical`, `billing`, `privacy`, `account` e `other`.

## Banco de dados

A migracao `20260904130000_add_password_reset_and_service_requests` cria `password_reset_tokens` e `service_requests`.

```powershell
npm.cmd run db:deploy
```

Ao finalizar a exclusao de uma conta, tokens de recuperacao e solicitacoes associadas ao email tambem sao removidos.
