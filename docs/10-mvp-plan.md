# EOS — MVP & Phased Development Plan

## Build philosophy

Ship the **highest-frequency, highest-value** workflows first: attendance and
payments are used daily and answer the owner's most urgent questions. Everything
is built on one schema and one API so later screens are thin.

## Phase 0 — Foundation ✅ (done in this milestone)

- Monorepo: `backend/` (NestJS), `frontend/` (Next.js), `docs/`, Docker, infra.
- Full PostgreSQL schema + migrations + seed data.
- Auth: JWT access/refresh with rotation, RBAC guards, argon2.
- Audit interceptor + immutable audit log.
- Global validation, error filter, rate limiting, Swagger.

## Phase 1 — Core MVP ✅ (done in this milestone)

| Area | Backend | Frontend |
|------|:------:|:--------:|
| Students (CRUD + analytics) | ✅ | ✅ list |
| Teachers (CRUD + stats) | ✅ | — |
| Groups + enrollment + schedule | ✅ | — |
| Attendance (roster + bulk mark + history) | ✅ | ✅ |
| Payments (status, monthly gen, overdue, summary) | ✅ | ✅ |
| Exams + results + trends | ✅ | — |
| Notes (chronological) | ✅ | — |
| Curriculum (topics + coverage) | ✅ | — |
| Risk engine + nightly job | ✅ | ✅ |
| Dashboards (admin + teacher) | ✅ | ✅ admin/teacher |
| Audit viewer | ✅ | — |

All backend endpoints are implemented and were verified end-to-end against a
live PostgreSQL during the build (login → RBAC → attendance → payments summary →
risk recompute).

## Phase 2 — Complete the UI (next)

Thin client screens over existing APIs:
1. Student profile page (analytics, notes timeline, exam trend chart).
2. Group detail + enroll/unenroll UI.
3. Exams & results entry screen.
4. Curriculum board (per group).
5. Audit log viewer.
6. Record-payment / create-invoice modals.
7. Charts (attendance over time, score trends) via a chart lib.

## Phase 3 — Portals & polish

1. Parent portal (read-only child view + payment status).
2. Student portal (homework, grades, attendance).
3. CSV import/export (bulk student onboarding, financial export).
4. Notifications (email/SMS for overdue + absence) — start with email.

## Phase 4 — AI features (architecture only for now)

See `11-ai-architecture.md`: progress summaries, risk prediction, teacher
performance scoring, parent-friendly reports. Built on top of the existing data
and an async job + provider abstraction. **Not** implemented yet.

## Definition of Done (per feature)

- Endpoint(s) with DTO validation + RBAC + audit on writes.
- Soft delete where the entity is long-lived.
- Indexes for the new query shapes.
- Screen with loading/empty/error states.
- Manual happy-path verified; unit tests for any non-trivial pure logic.

## Suggested sprint sequence (team of 2)

| Sprint | Focus |
|--------|-------|
| 1 | Phase 2 #1–#3 (profile, groups, exams UI) |
| 2 | Phase 2 #4–#7 (curriculum, audit, payment modals, charts) |
| 3 | Phase 3 portals + CSV |
| 4 | Notifications + hardening + CI/CD |
| 5+ | Phase 4 AI, incremental |
