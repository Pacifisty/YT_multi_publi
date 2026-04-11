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

## 3. Start API

```bash
npm run api:dev
```

On Windows PowerShell (restricted script policy):

```powershell
npm.cmd run api:dev
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
- `GET /workspace/media`
