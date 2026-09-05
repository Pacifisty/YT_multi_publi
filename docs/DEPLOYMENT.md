# Produção: banco, pagamentos e serviços

Este projeto inicia em modo de demonstração quando executado localmente sem credenciais. Em `NODE_ENV=production`, a inicialização é intencionalmente bloqueada se banco, pagamento, e-mail, URLs públicas, armazenamento ou credenciais centrais não estiverem configurados.

## 1. Preparar as variáveis

Use [.env.production.example](../.env.production.example) apenas como lista de nomes. Cadastre os valores no gerenciador de segredos da hospedagem; não envie `.env.production` ao repositório.

Valide sem imprimir nenhum segredo:

```powershell
npm.cmd run verify:production
```

O verificador exige:

- PostgreSQL gerenciado em `DATABASE_URL`;
- domínio público HTTPS e callbacks OAuth correspondentes;
- chave AES de 32 bytes em `OAUTH_TOKEN_KEY`;
- hash scrypt ou Argon2 para o administrador;
- credenciais Google, TikTok e Instagram;
- credencial de produção e assinatura de webhook do Mercado Pago;
- provedor transacional de e-mail real;
- diretório absoluto de volume persistente para mídia.

## 2. Banco PostgreSQL

Depois de cadastrar `DATABASE_URL`:

```powershell
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run verify:prisma-startup
```

A migração `20260904090000_add_payment_intents` cria a tabela que preserva checkout, estado, referência externa e reconciliação de webhook. O servidor também verifica as tabelas obrigatórias ao conectar e recusa subir com esquema incompleto.

## 3. Senha administrativa

Não use `plain:` ou SHA-256 em produção. No PowerShell:

```powershell
$env:ADMIN_PASSWORD='uma-senha-longa-e-unica'
npm.cmd run security:hash-admin
Remove-Item Env:ADMIN_PASSWORD
```

Copie somente o resultado `scrypt:...` para `ADMIN_PASSWORD_HASH` no gerenciador de segredos.

## 4. Mercado Pago

Cadastre um Access Token de produção (`APP_USR-...`), crie uma configuração de Webhooks para o evento de pagamentos e copie a chave secreta para `MERCADOPAGO_WEBHOOK_SECRET`.

URL registrada:

```text
https://SEU-DOMINIO/api/account/payments/webhook
```

As URLs de sucesso e cancelamento também precisam ser HTTPS. O servidor valida `x-signature`, consulta o pagamento diretamente no provedor e usa eventos persistentes para evitar processamento duplicado.

## 5. E-mail transacional

Escolha `resend`, `sendgrid` ou `mailgun`. Para a configuração mínima:

```text
EMAIL_PROVIDER=resend
EMAIL_PROVIDER_API_KEY=...
EMAIL_FROM_ADDRESS=PMP <noreply@seu-dominio.com>
```

Valide o domínio remetente no provedor. O adaptador mock é aceito em desenvolvimento e proibido em produção.

## 6. OAuth e publicação

Registre exatamente as URLs de callback declaradas no arquivo de exemplo nos painéis do Google, TikTok e Meta. Divergência de protocolo, domínio, caminho ou query string pode invalidar o callback.

Os tokens retornados são criptografados com AES-256-GCM usando `OAUTH_TOKEN_KEY`. Faça backup seguro dessa chave: trocá-la impede a leitura dos tokens já gravados e exige reconectar as contas.

## 7. Arquivos de mídia

A implementação atual usa armazenamento local. Em produção, `MEDIA_STORAGE_ROOT` deve apontar para um volume persistente montado, por exemplo `/data/storage`. Não use o filesystem efêmero da aplicação.

Cloudflare R2 ainda não está conectado ao código; definir variáveis `R2_*` sozinho não muda o armazenamento. Para múltiplas réplicas, deve-se implementar um adaptador de object storage antes de escalar horizontalmente.

## 8. Implantar e verificar

No comando de release, aplique as migrações antes de iniciar a API:

```text
npm run db:deploy && npm run api:start
```

Após subir:

1. `GET /health` deve retornar 200.
2. `GET /ready` deve confirmar o banco conectado.
3. Crie um checkout de valor mínimo e conclua com uma conta real controlada.
4. Confirme o pagamento em `payment_intents` e o evento em `webhook_events`.
5. Confirme o e-mail transacional e os três callbacks OAuth.
6. Envie uma mídia pequena e reinicie a aplicação para provar a persistência do volume.

## Estado local atual

Sem PostgreSQL instalado, token `APP_USR`, chave de webhook, domínio de e-mail validado e credenciais OAuth, o ambiente local continua deliberadamente em modo de demonstração. Nenhum valor falso deve ser promovido para produção.
