# EOS — Database Schema

PostgreSQL 16, modeled with Prisma. Source of truth: `backend/prisma/schema.prisma`.
Generated SQL: `backend/prisma/migrations/`.

## 1. Tables overview

| Table | Purpose | Key relations |
|-------|---------|---------------|
| `users` | Auth principals + role | 1:1 → teacher/student/parent |
| `refresh_tokens` | Hashed rotating sessions | N:1 → user |
| `branches` | Campuses | 1:N → students, groups |
| `programs` | SAT / AP / IB / … | 1:N → subjects |
| `subjects` | "SAT Math", "AP Physics" | N:1 → program; 1:N → groups, exams, topics |
| `teachers` | Teacher profile | 1:1 → user; 1:N → groups |
| `students` | Student profile + status | N:1 → branch; 1:N → enrollments, payments, … |
| `parents` | Parent profile | 1:1 → user; M:N → students |
| `student_parents` | Parent↔student link | join |
| `groups` | Class group + fee + status | N:1 → subject/teacher/branch |
| `group_schedules` | Weekly recurring slots | N:1 → group |
| `group_students` | Enrollment (M:N) + lifecycle | join (student↔group) |
| `lessons` | A dated session of a group | N:1 → group; 1:N → attendance |
| `attendance` | Per-student per-lesson status | N:1 → lesson/student |
| `payments` | Monthly invoice + status | N:1 → student/group |
| `exams` | Exam metadata + max score | N:1 → subject/group |
| `exam_results` | Per-student score | N:1 → exam/student |
| `teacher_notes` | Chronological academic notes | N:1 → student/teacher/author |
| `curriculum_topics` | Syllabus items per subject | N:1 → subject |
| `curriculum_progress` | Per-group topic status | N:1 → group/topic |
| `risk_flags` | Computed risk (current + history) | N:1 → student |
| `audit_logs` | Immutable change trail | N:1 → actor (user) |

## 2. Enums

`Role`, `StudentStatus`, `EnrollmentStatus`, `GroupStatus`, `Weekday`,
`AttendanceStatus`, `PaymentStatus`, `NoteType`, `TopicStatus`, `RiskLevel`,
`AuditAction`. Using DB-level enums enforces closed value sets at the storage
layer (not just the application).

## 3. Money & dates

- All monetary columns are `Decimal(10,2)` — never floating point.
- Dates that represent a calendar day (lesson date, due date, exam date) use
  `@db.Date`; timestamps use `timestamptz` via Prisma defaults.

## 4. Index strategy

Every foreign key is indexed. Additional indexes target the actual query shapes:

| Table | Indexes | Rationale |
|-------|---------|-----------|
| `students` | `status`, `lastName`, `branchId`, `enrollmentDate` | list filters + name search + sort |
| `payments` | `studentId`, `status`, `dueDate`, `(periodYear, periodMonth)` | overdue scans + monthly summary |
| `attendance` | `(lessonId, studentId)` unique, `studentId`, `status` | upsert + per-student analytics |
| `lessons` | `(groupId, date)` unique, `date` | one lesson per group/day; date ranges |
| `risk_flags` | `studentId`, `level`, `isCurrent` | current at-risk lists |
| `audit_logs` | `(entity, entityId)`, `action`, `actorUserId`, `createdAt` | investigations |
| `teacher_notes` | `studentId`, `type`, `createdAt` | chronological history |

## 5. Constraints (integrity)

- **Unique business keys**: one enrollment per `(group, student)`; one lesson per
  `(group, date)`; one attendance per `(lesson, student)`; one exam result per
  `(exam, student)`; one invoice per `(student, group, year, month)`.
- **Referential actions**: `Cascade` for owned children (schedules, attendance,
  results); `SetNull` for optional references (a deleted teacher leaves groups
  intact); `Restrict` to protect referenced subjects from accidental deletion.

## 6. Soft delete

Long-lived domain entities carry `deletedAt`. Application queries filter
`deletedAt: null`. This preserves history and keeps audit/foreign references
valid. Join/event tables (attendance, results, audit) are not soft-deleted.

## 7. Audit

`audit_logs` is **append-only** in application code — never updated or deleted.
Written by `AuditInterceptor` for any `@Audit`-annotated endpoint plus explicit
`LOGIN` events. Captures actor, action, entity, entityId, new value (sanitized),
IP and user-agent.
