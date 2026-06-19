# EOS — Security Model

## Authentication

- **Passwords** hashed with **argon2** (memory-hard). Never stored or logged in plaintext.
- **JWT access token** (short-lived, default 15m) sent as `Bearer`.
- **Refresh token** (default 7d) is:
  - signed with a *separate* secret,
  - stored **hashed (SHA-256)** in `refresh_tokens`,
  - **rotated** on every refresh (old one revoked),
  - revoked on logout and on password change (all sessions).
- A token is only accepted if the user is still `isActive` and not soft-deleted
  (re-checked on every request in `JwtStrategy.validate`).

## Authorization (RBAC)

- Global `JwtAuthGuard` — every route authenticated unless `@Public()`.
- Global `RolesGuard` — routes declare `@Roles(...)`; `SUPER_ADMIN` bypasses.
- **Data-scoping** beyond role: teachers can only read/write **their assigned
  groups** for attendance, exams, and curriculum (enforced in services, not just
  the controller). Financial endpoints are admin-only.

| Capability | SUPER_ADMIN | ADMIN | TEACHER | PARENT | STUDENT |
|------------|:----------:|:-----:|:-------:|:------:|:-------:|
| Manage students/teachers/groups | ✅ | ✅ | — | — | — |
| Mark attendance (own groups) | ✅ | ✅ | ✅ | — | — |
| Enter exams/notes (own groups) | ✅ | ✅ | ✅ | — | — |
| View payments / revenue | ✅ | ✅ | — | — | — |
| View audit log | ✅ | ✅ | — | — | — |
| View own child / self | ✅ | ✅ | — | ✅ | ✅ |

## Transport & headers

- **Helmet** sets secure HTTP headers.
- **CORS** restricted to configured origins (`CORS_ORIGINS`).
- HTTPS terminated by the platform (Vercel / Render / Railway).

## Input & output

- **class-validator** DTOs with `whitelist` + `forbidNonWhitelisted` reject
  unknown/extra fields; `ParseUUIDPipe` validates ids.
- Prisma parameterizes all queries → no SQL injection.
- Errors are normalized; internal details aren't leaked to clients.

## Rate limiting

- `@nestjs/throttler` — 100 requests / 60s / IP by default (tunable). Protects
  login and write endpoints from brute force / abuse.

## Auditing & non-repudiation

- Every sensitive write is recorded in `audit_logs` (actor, action, entity,
  entityId, new value, IP, user-agent). Logins recorded explicitly.
- The table is append-only in application code — **no silent changes**.
- Sensitive fields (`password`, tokens) are redacted before persisting bodies.

## Secrets management

- All secrets via environment variables (`.env` locally; platform secret store
  in production). `.env` is git-ignored; `.env.example` documents the shape.
- Distinct secrets for access vs refresh tokens; rotate by changing env values.

## Hardening checklist before go-live

- [ ] Replace all default secrets (`openssl rand -base64 48`).
- [ ] Set real `CORS_ORIGINS` (no wildcards).
- [ ] Change the seeded admin password; remove demo accounts.
- [ ] Enforce TLS-only DB connection (`sslmode=require`, default on Neon).
- [ ] Review rate limits for login specifically.
- [ ] Enable platform backups on Neon.
