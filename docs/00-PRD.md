# EOS — Product Requirements Document

## 1. Vision

The **Education Operating System (EOS)** is the single source of truth for a
Mathematics / Physics / SAT / AP / IB academy. It replaces spreadsheets and
WhatsApp groups with one system that answers the owner's questions instantly:
who attended today, who owes money, who is improving, and who is at risk of
leaving.

## 2. Target scale (current phase)

| Dimension | Target |
|-----------|--------|
| Students  | up to 500 |
| Teachers  | up to 50 |
| Branches  | 1–few |
| Concurrent users | dozens (teachers marking attendance at class time) |

The architecture is a **modular monolith** — deliberately simple (no
microservices, Kubernetes, or Kafka). It can grow to a few thousand students
before any structural change is needed.

## 3. Personas & roles

| Role | Needs | Access |
|------|-------|--------|
| **Super Admin / Admin** | Run the academy; see everything | Full |
| **Teacher** | Mark attendance, enter grades/notes fast on mobile | Assigned groups only; **no financial data** |
| **Parent** | Track their child | Read-only child view |
| **Student** | See own homework/grades/attendance | Read-only self view |

## 4. Core questions the system must answer instantly

Who are my students? · Who attended today? · Who is frequently absent? · Who has
overdue payments? · Who is improving / at risk? · Which teachers perform best? ·
Which groups lag? · What curriculum is covered? · What revenue is expected,
collected, and overdue this month?

## 5. Functional modules (MVP)

1. **Student management** — profile, status (Active/Frozen/Graduated/Left), groups, analytics.
2. **Teacher management** — subjects, groups, employment, performance stats.
3. **Groups** — subject, teacher, schedule, monthly fee, roster.
4. **Attendance** — one-screen, one-click PRESENT/ABSENT/LATE/EXCUSED, history, analytics.
5. **Payments** — monthly fees, discounts, partial payments, due dates, auto-overdue, revenue dashboard.
6. **Academic progress** — chronological lesson/progress/strength/weakness notes per student.
7. **Curriculum tracking** — per-group topic completion and coverage %.
8. **Exams** — exams, scores, trends, per-exam statistics.
9. **Risk detection** — automatic flags (LOW/MEDIUM/HIGH/CRITICAL) from rules.
10. **Dashboards** — admin overview + teacher daily view.
11. **Audit** — who changed what, when, old/new value, IP — no silent changes.

## 6. Risk rules (v1)

A student is flagged when any of these hold; points combine into a 0–100 score:

| Rule | Threshold | Weight |
|------|-----------|--------|
| Low attendance | < 70% (min 4 sessions) | 30 (scaled) |
| Overdue payment | > 15 days | 30 |
| Exam score drop | > 15% between last two exams | 25 |
| Inactivity | no attendance ≥ 10 days | 25 |

Score → level: `≥80 CRITICAL`, `≥55 HIGH`, `≥30 MEDIUM`, else `LOW`.

## 7. Non-functional requirements

- **Fast & mobile-first** for the attendance workflow (the most frequent action).
- **Pagination, filtering, search** on every list (server-side).
- **Security**: JWT access/refresh, RBAC, hashed passwords (argon2), rate limiting, Helmet, input validation.
- **Auditability**: every write to a sensitive entity recorded immutably.
- **Cost**: runs entirely on free tiers (Neon + Render/Railway + Vercel).

## 8. Out of scope (this phase)

AI features (summaries, prediction, auto-reports) — architecture only, see
`11-ai-architecture.md`. Messaging/SMS, timetable conflict solving, and
multi-currency are future candidates.

## 9. Success metrics

- Attendance for a class marked in **< 30 seconds**.
- Owner can see today's attendance, overdue revenue, and at-risk list in **one screen**.
- Zero "silent" edits — 100% of sensitive writes carry an audit row.
