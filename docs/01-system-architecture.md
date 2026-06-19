# EOS — System Architecture

## 1. High-level diagram

```
                         ┌─────────────────────────────┐
                         │      Browser / Mobile web     │
                         └───────────────┬───────────────┘
                                         │ HTTPS
                          ┌──────────────▼───────────────┐
                          │   Next.js 15 (App Router)     │
                          │   Vercel — free tier          │
                          │   • UI, auth context          │
                          │   • token storage + refresh   │
                          └──────────────┬───────────────┘
                                         │ REST  /api/v1  (JWT Bearer)
                          ┌──────────────▼───────────────┐
                          │   NestJS modular monolith     │
                          │   Render / Railway — free     │
                          │   • RBAC guards               │
                          │   • business logic            │
                          │   • risk engine + cron jobs   │
                          │   • audit interceptor         │
                          └───────┬──────────────┬────────┘
                                  │ Prisma       │ (optional)
                          ┌───────▼──────┐  ┌────▼─────────┐
                          │ PostgreSQL   │  │   Redis      │
                          │ Neon — free  │  │  cache/rate  │
                          └──────────────┘  └──────────────┘
```

## 2. Why a modular monolith

For ≤500 students the dominant cost is *development speed and operability*, not
horizontal scale. A single deployable NestJS app with clear module boundaries:

- one process to deploy, log, and debug;
- transactional integrity without distributed sagas;
- modules (`students`, `attendance`, `payments`, …) that could later be split
  into services **if** scale ever demands it — the boundaries already exist.

Explicitly avoided per the brief: microservices, Kubernetes, Kafka.

## 3. Components

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| Web | Next.js 15, TypeScript, Tailwind, ShadCN-style UI | Rendering, auth UX, calling the API |
| API | NestJS 10 | Auth, RBAC, validation, business logic, scheduling |
| ORM | Prisma 5 | Type-safe queries + migrations |
| DB | PostgreSQL 16 (Neon) | Source of truth |
| Cache | Redis (optional) | Hot reads / rate-limit store at higher scale |
| Auth | JWT (access + rotating refresh), argon2 | Stateless auth with revocation |

## 4. Request lifecycle

1. Browser sends `Authorization: Bearer <access>`.
2. `JwtAuthGuard` validates the token (skips routes marked `@Public`).
3. `RolesGuard` enforces `@Roles(...)`; `SUPER_ADMIN` bypasses.
4. `ThrottlerGuard` applies rate limits.
5. `ValidationPipe` validates/serializes the DTO.
6. Controller → Service → Prisma → PostgreSQL.
7. `AuditInterceptor` records an audit row for `@Audit`-annotated writes.
8. `HttpExceptionFilter` normalizes errors (including Prisma `P2002`/`P2025`).

## 5. Background processing

In-process scheduler (`@nestjs/schedule`) — no external queue needed at this scale:

- **02:00 daily** — recompute OVERDUE payment statuses.
- **03:00 daily** — recompute risk flags for all active students.

Both jobs are idempotent and also exposed as admin-triggerable endpoints.

## 6. Scaling path (when needed)

1. Add Redis caching for dashboard aggregates.
2. Move heavy aggregation to materialized views / read replica (Neon supports replicas).
3. Extract the risk engine + reporting into a worker if cron contention appears.
4. Only then consider splitting modules into services.
