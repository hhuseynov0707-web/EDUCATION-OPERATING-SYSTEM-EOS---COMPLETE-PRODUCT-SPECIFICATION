# EOS — Education Operating System

The single source of truth for a Mathematics / Physics / SAT / AP / IB academy.
EOS answers the owner's questions instantly — who attended today, who owes money,
who is improving, and **who is at risk of leaving** — in one clean system.

Built as a **modular monolith**: NestJS + PostgreSQL (Prisma) on the backend,
Next.js + Tailwind on the frontend. Designed for up to **500 students / 50
teachers** and to run on **free hosting** (Neon + Render/Railway + Vercel).

---

## Features (implemented)

- 🔐 **Auth & RBAC** — JWT access/refresh with rotation, argon2 hashing, roles
  (Super Admin / Admin / Teacher / Parent / Student).
- 👨‍🎓 **Students** — profiles, status lifecycle, per-student analytics
  (attendance %, payments, exam history, progress score).
- 👩‍🏫 **Teachers** — profiles + performance stats; account auto-provisioned.
- 👥 **Groups** — subject, teacher, weekly schedule, monthly fee, enrollment.
- ✅ **Attendance** — one-screen, one-click P/A/L/E, bulk save, history.
- 💳 **Payments** — fees, discounts, partial payments, **auto-overdue**, monthly
  invoice generation, revenue summary (expected / collected / overdue).
- 📈 **Exams** — exams, bulk results, per-exam stats, student score trends.
- 📝 **Notes** — chronological academic notes (strength/weakness/progress).
- 📚 **Curriculum** — topic completion per group + coverage %.
- 🚨 **Risk engine** — automatic LOW/MEDIUM/HIGH/CRITICAL flags from attendance,
  overdue payments, exam drops, and inactivity (nightly + on-demand).
- 📊 **Dashboards** — admin overview + teacher daily view.
- 🧾 **Audit log** — immutable record of who changed what, when, with IP.

## Tech stack

| | |
|---|---|
| Frontend | Next.js 15, TypeScript, TailwindCSS, ShadCN-style UI |
| Backend | NestJS 10 (modular monolith), Prisma 5 |
| Database | PostgreSQL 16 (Neon in prod) |
| Auth | JWT (access + rotating refresh), argon2, RBAC |
| Infra | Docker + docker-compose; Render/Railway + Vercel + Neon (free) |

## Repository layout

```
.
├── backend/        # NestJS API + Prisma schema/migrations/seed
├── frontend/       # Next.js app (App Router)
├── docs/           # PRD, architecture, ER diagram, API, security, deployment…
├── docker-compose.yml
├── render.yaml     # one-click backend deploy blueprint
└── .env.example
```

## Quick start (Docker)

```bash
cp .env.example .env          # adjust secrets
docker compose up --build
# backend  → http://localhost:4000/api/v1   (Swagger at /api/docs)
# frontend → http://localhost:3000
```

## Quick start (local, no Docker)

```bash
# 1) Backend
cd backend
cp ../.env.example .env        # point DATABASE_URL/DIRECT_URL at local Postgres
npm install
npx prisma migrate dev
npm run db:seed
npm run start:dev              # http://localhost:4000/api/v1

# 2) Frontend (new terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1" > .env.local
npm run dev                    # http://localhost:3000
```

### Default logins (from the seed)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@eos.local` | `Admin123!change` |
| Teacher | `aysel@eos.local` | `Teacher123!` |
| Teacher | `rashad@eos.local` | `Teacher123!` |

> After seeding, sign in as admin and click **Recompute now** on the At-Risk page
> (or `POST /api/v1/risk/recompute`) to populate risk flags. The seed includes a
> deliberately at-risk student to demonstrate the engine.

## Documentation

| Doc | |
|-----|---|
| [Product Requirements](docs/00-PRD.md) | scope, personas, risk rules |
| [System Architecture](docs/01-system-architecture.md) | components, request flow |
| [Database Schema](docs/02-database-schema.md) | tables, indexes, constraints |
| [ER Diagram](docs/03-er-diagram.md) | Mermaid entity diagram |
| [API Design](docs/04-api-design.md) | every endpoint |
| [Backend Architecture](docs/05-backend-architecture.md) | NestJS structure |
| [Frontend Architecture](docs/06-frontend-architecture.md) | Next.js structure |
| [UI/UX Screens](docs/07-ui-ux-screens.md) | screen inventory |
| [Security Model](docs/08-security-model.md) | auth, RBAC, hardening |
| [Deployment Plan](docs/09-deployment-plan.md) | Neon + Render/Railway + Vercel |
| [MVP & Roadmap](docs/10-mvp-plan.md) | phases & status |
| [AI Architecture](docs/11-ai-architecture.md) | Phase 2 design (not built) |

## Status

Phases 0–2 are complete. The full backend is implemented and verified
end-to-end against a live PostgreSQL. The web app now covers the full daily
workflow:

- Admin & teacher **dashboards** (cards deep-link to the relevant screen)
- **Students** list + **student profile** (analytics, exam trend chart, notes
  timeline with inline quick-add)
- **Groups** list + **group detail** (schedule, roster, **curriculum board**, exams)
- **Attendance** fast-mark (group preselectable from the teacher dashboard)
- **Exams** list + create + **fast per-student score entry** with ranked results
- **Payments** (revenue summary, statuses, monthly generation)
- **At-Risk** list with recompute
- **Audit log** viewer (admin)

See [docs/10-mvp-plan.md](docs/10-mvp-plan.md) for deferred follow-ups and Phase 3+.
