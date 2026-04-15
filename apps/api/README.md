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

2. Set `DATABASE_URL` in `.env` to:

```text
postgresql://postgres:postgres@127.0.0.1:5432/yt_multi_publi?schema=public
```

3. Generate Prisma Client and apply migrations:

```powershell
npm.cmd run db:generate
npm.cmd run db:deploy
```

When `DATABASE_URL` is configured and migrations are applied, `/health` should report:

- `database.configured: true`
- `database.mode: "prisma"`
- `database.connected: true`

`/ready` should return:

- HTTP `200`
- `status: "ready"`
- `ready: true`

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

## Startup troubleshooting

If startup fails with:

```text
DATABASE_URL is configured, but Prisma Client is not available.
```

Run:

```powershell
npm.cmd install
npm.cmd run db:generate
```

If startup fails with:

```text
Database schema is missing required tables: ...
```

Run:

```powershell
npm.cmd run db:deploy
```

If PostgreSQL is reachable but the configured database itself does not exist, create it manually or recreate the bundled Docker volume:

```powershell
docker compose down -v
docker compose up -d
```

That resets the bundled `postgres` service and recreates the default `yt_multi_publi` database from `docker-compose.yml`.

If `docker compose up -d` fails before that, make sure Docker Desktop is running and the Linux engine is available.

To verify the full local Prisma startup flow in one command:

```powershell
npm.cmd run verify:prisma-startup
```

This command runs `db:generate`, `db:deploy`, starts the API, and confirms that `/health` and `/ready` report Prisma as connected and ready.

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
