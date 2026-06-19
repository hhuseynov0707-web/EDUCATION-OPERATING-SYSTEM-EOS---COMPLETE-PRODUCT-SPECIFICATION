# EOS — Deployment Plan (Free Tier)

Target: **$0/month** for ≤500 students using Neon + Render/Railway + Vercel.

```
Vercel (Next.js)  ──►  Render or Railway (NestJS)  ──►  Neon (PostgreSQL)
```

## 1. Database — Neon (free)

1. Create a project at neon.tech → a database named `eos`.
2. Copy **two** connection strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL` (append `&pgbouncer=true`).
   - **Direct** (no `-pooler`) → `DIRECT_URL` (used by `prisma migrate`).
3. Both use `sslmode=require`.

Prisma is already configured with `url` + `directUrl` for this split
(`backend/prisma/schema.prisma`).

## 2. Backend — Render (free) or Railway

**Render** (blueprint provided: `render.yaml`):
1. New → Blueprint → point at this repo. Render reads `render.yaml`.
2. Set secrets: `DATABASE_URL`, `DIRECT_URL`, `CORS_ORIGINS` (your Vercel URL).
   `JWT_*` secrets are auto-generated.
3. The Docker image runs `prisma migrate deploy` on boot, then starts the API.
4. Health check: `/api/v1/health`.

**Railway** (alternative):
1. New Project → Deploy from repo → root `backend/` (Dockerfile detected).
2. Add the same environment variables.
3. Start command (from Dockerfile): `prisma migrate deploy && node dist/main.js`.

> Free instances sleep when idle; the first request after idle is slow. Fine for
> an internal academy tool. Run the seed once from your machine against Neon:
> `cd backend && DATABASE_URL=... DIRECT_URL=... npm run db:seed`.

## 3. Frontend — Vercel (free)

1. Import the repo, set **root directory** = `frontend`.
2. Env var: `NEXT_PUBLIC_API_URL = https://<your-backend>/api/v1`.
3. Deploy → you get `https://<project>.vercel.app`.
4. Put that URL in the backend's `CORS_ORIGINS`.

## 4. Local development (Docker Compose)

```bash
cp .env.example .env            # adjust secrets
docker compose up --build       # postgres + redis + backend + frontend
# backend  → http://localhost:4000/api/v1   (docs at /api/docs)
# frontend → http://localhost:3000
```

## 5. Local development (without Docker)

```bash
# Postgres running locally; then:
cd backend
cp ../.env.example .env          # set DATABASE_URL / DIRECT_URL to localhost
npm install
npx prisma migrate dev
npm run db:seed
npm run start:dev                # http://localhost:4000

cd ../frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1" > .env.local
npm run dev                      # http://localhost:3000
```

Default seeded login: `admin@eos.local` / `Admin123!change`.

## 6. CI/CD (recommended next step)

- GitHub Actions: on PR → `npm ci && npm run build` for both apps + `prisma validate`.
- On merge to `main` → Vercel auto-deploys the frontend; Render/Railway
  auto-deploys the backend (migrations run on boot).

## 7. Operations

- **Backups**: enable Neon's automatic backups / branching.
- **Migrations**: created with `prisma migrate dev` locally, committed, applied in
  prod automatically via `prisma migrate deploy`.
- **Monitoring**: platform logs + `/api/v1/health`. Add Sentry/Logtail later.
