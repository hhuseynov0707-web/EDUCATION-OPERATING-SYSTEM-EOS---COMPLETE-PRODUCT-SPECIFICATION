# EOS — Backend Architecture (NestJS)

## Folder structure

```
backend/
├── prisma/
│   ├── schema.prisma         # full data model (source of truth)
│   ├── migrations/           # generated SQL migrations
│   └── seed.ts               # demo dataset (admin, teachers, students, …)
├── src/
│   ├── main.ts               # bootstrap: helmet, CORS, versioning, Swagger
│   ├── app.module.ts         # wires modules + global guards
│   ├── health.controller.ts  # /health
│   ├── prisma/               # global PrismaService + module
│   ├── common/
│   │   ├── decorators/       # @Public @Roles @CurrentUser @Audit
│   │   ├── guards/           # JwtAuthGuard, RolesGuard
│   │   ├── interceptors/     # AuditInterceptor
│   │   ├── filters/          # HttpExceptionFilter
│   │   └── dto/              # PaginationDto + helpers
│   └── modules/
│       ├── auth/             # login/refresh/logout, JWT strategy
│       ├── catalog/          # programs, subjects, branches
│       ├── students/
│       ├── teachers/
│       ├── groups/
│       ├── attendance/
│       ├── payments/
│       ├── exams/
│       ├── notes/
│       ├── curriculum/
│       ├── risk/             # risk engine
│       ├── dashboard/        # admin + teacher aggregations
│       ├── audit/            # read-only log viewer
│       └── tasks/            # scheduled cron jobs
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Module anatomy

Each feature module follows the same shape:

```
modules/<feature>/
  dto/                 # class-validator DTOs (request shapes)
  <feature>.service.ts # business logic + Prisma access
  <feature>.controller.ts # HTTP routes, @Roles, @Audit
  <feature>.module.ts  # providers + exports
```

Services contain logic and are unit-testable in isolation; controllers are thin.

## Cross-cutting concerns

- **Auth**: `JwtAuthGuard` is global (`APP_GUARD`). Routes opt out with `@Public()`.
- **Authorization**: `RolesGuard` is global; routes declare `@Roles(...)`.
- **Rate limiting**: `ThrottlerGuard` global (100 req/60s/IP).
- **Validation**: global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`).
- **Auditing**: `@Audit({action, entity})` + `AuditInterceptor` write an immutable row after the handler succeeds.
- **Errors**: `HttpExceptionFilter` maps exceptions (incl. Prisma `P2002`→409, `P2025`→404) to a uniform envelope.

## Business-logic highlights

- **Attendance** (`attendance.service.ts`): `roster()` is read-only; `mark()`
  upserts the lesson and all attendance rows in a single `$transaction`.
  Teachers are restricted to their assigned groups.
- **Payments** (`payments.service.ts`): pure `computeStatus()` resolver
  (PAID/PARTIAL/PENDING/OVERDUE), idempotent `generateMonthly()`, and
  `summary()` for the revenue dashboard.
- **Risk** (`risk.service.ts`): `RISK_RULES` thresholds → weighted 0–100 score →
  level; keeps one current flag per student with history on change.
- **Tasks** (`tasks.service.ts`): nightly overdue + risk recompute via `@Cron`.

## Testing strategy

- **Unit**: pure functions (`computeStatus`, `scoreToLevel`) and services with a
  mocked Prisma client.
- **e2e**: spin up the app against a disposable Postgres, run the auth →
  attendance → payment → risk happy paths (the flows verified manually during build).
