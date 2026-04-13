# API Local Run

## 1. Install dependencies

```bash
npm install
```

On Windows PowerShell with restricted script policy, use:

```powershell
npm.cmd install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Fill any real credentials you need.  
`DATABASE_URL` can stay empty for in-memory mode.

For persistent local development with PostgreSQL:

1. Start the included database service:

```powershell
docker compose up -d
```

2. Set this in `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/yt_multi_publi?schema=public
```

3. Generate Prisma Client and apply migrations:

```powershell
npm.cmd run db:generate
npm.cmd run db:deploy
```

When `DATABASE_URL` is configured and migrations are applied, `/health` should report:

- `database.configured: true`
- `database.mode: "prisma"`

For YouTube account connection (Google OAuth), set:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/workspace/accounts/callback`

In Google Cloud Console, the same URI must be added as an authorized redirect URI.

## 3. Start API

```bash
npm run api:dev
```

On Windows PowerShell (restricted script policy):

```powershell
npm.cmd run api:dev
```

Useful Prisma commands on Windows:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:deploy
npm.cmd run db:push
npm.cmd run db:studio
```

Default health endpoints:

- `GET /health`
- `GET /ready`

Frontend routes served by the same process:

- `GET /` (SPA shell)
- `GET /login`
- `GET /workspace/dashboard`
- `GET /workspace/campanhas`
- `GET /workspace/campanhas/nova`
- `GET /workspace/campanhas/:campaignId`
- `GET /workspace/accounts`
- `GET /workspace/accounts/callback` (Google OAuth return route)
- `GET /workspace/media`
