# EOS — API Design

REST, JSON, versioned under `/api/v1`. Interactive docs (Swagger/OpenAPI) at
`/api/docs` when the backend runs. Auth via `Authorization: Bearer <accessToken>`.

## Conventions

- **Pagination**: `?page=1&limit=20` → `{ data: [...], meta: { page, limit, total, totalPages } }`.
- **Search/filter**: `?search=`, plus resource-specific filters (`status`, `groupId`, …).
- **Errors**: `{ statusCode, error, message, path, timestamp }`.
- **RBAC** noted per route; `SUPER_ADMIN` implicitly passes all role checks.

## Auth — `/auth`
| Method | Path | Roles | Body / notes |
|--------|------|-------|------|
| POST | `/auth/login` | public | `{ email, password }` → `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | public | `{ refreshToken }` → new token pair (rotates) |
| POST | `/auth/logout` | public | `{ refreshToken }` → revokes |
| GET  | `/auth/me` | any | current user |
| POST | `/auth/change-password` | any | `{ currentPassword, newPassword }` (revokes sessions) |

## Catalog — `/catalog`
`GET/POST /catalog/programs` · `GET/POST /catalog/subjects` · `GET/POST /catalog/branches`
(reads: any authenticated; writes: admin).

## Students — `/students` (admin write; admin/teacher read)
`POST /` · `GET /?page&limit&search&status&groupId&branchId` ·
`GET /:id` (includes computed **analytics**: attendance %, payments, exams, progressScore) ·
`PATCH /:id` · `DELETE /:id` (soft delete).

## Teachers — `/teachers` (admin)
`POST /` (also provisions the login user) · `GET /?page&limit&search` ·
`GET /:id` (includes **stats**: groupCount, studentCount, attendanceQuality, avgExamPercentage) ·
`PATCH /:id` · `DELETE /:id`.

## Groups — `/groups`
`POST /` (admin) · `GET /` · `GET /:id` (roster + curriculum coverage) ·
`PATCH /:id` · `DELETE /:id` · `POST /:id/enroll` `{ studentIds[] }` ·
`DELETE /:id/enroll/:studentId`.

## Attendance — `/attendance` (teacher/admin; teachers limited to own groups)
| Method | Path | Notes |
|--------|------|------|
| GET | `/attendance/roster?groupId&date` | active roster pre-filled with existing marks |
| POST | `/attendance/mark` | `{ groupId, date, topic?, records:[{studentId,status,note?}] }` — upserts lesson + all marks in one transaction |
| GET | `/attendance/history?groupId&from&to` | per-lesson counts + present rate |

## Payments — `/payments` (admin only)
| Method | Path | Notes |
|--------|------|------|
| POST | `/payments` | create invoice |
| GET | `/payments?status&studentId&periodYear&periodMonth&page&limit` | list |
| GET | `/payments/summary?year&month` | expected / collected / overdue / collection rate |
| PATCH | `/payments/:id/record` | `{ amountPaid, note? }` → recomputes status |
| POST | `/payments/generate-monthly` | `{ periodYear, periodMonth, dueDay? }` — one invoice per active enrollment |
| POST | `/payments/recalculate-overdue` | flips past-due invoices to OVERDUE |

## Exams — `/exams` (teacher/admin)
`POST /` · `GET /?groupId` · `GET /:id` (results + stats) ·
`POST /:id/results` `{ results:[{studentId,score,note?}] }` ·
`GET /exams/student/:studentId/trend`.

## Notes — `/notes` (teacher/admin)
`POST /` · `GET /notes/student/:studentId` (chronological) · `DELETE /:id`.

## Curriculum — `/curriculum`
`POST /topics` (admin) · `GET /topics?subjectId` ·
`GET /curriculum/group/:groupId` (board + coverage %) ·
`POST /curriculum/group/:groupId/status` `{ topicId, status }`.

## Risk — `/risk` (admin)
`GET /?minLevel` · `GET /risk/student/:id` (history) · `POST /risk/recompute`.

## Dashboard — `/dashboard`
`GET /dashboard/admin` (admin) · `GET /dashboard/teacher` (teacher/admin).

## Audit — `/audit-logs` (admin)
`GET /?page&limit&entity&action`.

## Health — `/health` (public)
`GET /health` → `{ status, db }`.
