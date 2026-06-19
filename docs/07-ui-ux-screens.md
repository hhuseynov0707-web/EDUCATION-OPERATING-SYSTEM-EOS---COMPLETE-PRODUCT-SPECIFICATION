# EOS — UI/UX Screens

## Screen inventory

| # | Screen | Route | Role | Status in MVP |
|---|--------|-------|------|---------------|
| 1 | Login | `/login` | all | ✅ built |
| 2 | Admin Dashboard | `/dashboard` | admin | ✅ built |
| 3 | Teacher Dashboard | `/dashboard` | teacher | ✅ built |
| 4 | Students list | `/students` | admin/teacher | ✅ built |
| 5 | Attendance marking | `/attendance` | teacher/admin | ✅ built |
| 6 | Payments | `/payments` | admin | ✅ built |
| 7 | At-Risk | `/risk` | admin | ✅ built |
| 8 | Student profile | `/students/:id` | admin/teacher | API ready (analytics endpoint) |
| 9 | Group detail / roster | `/groups/:id` | admin/teacher | API ready |
| 10 | Curriculum board | `/curriculum/:groupId` | teacher/admin | API ready |
| 11 | Exams & results | `/exams` | teacher/admin | API ready |
| 12 | Audit log viewer | `/audit` | admin | API ready |
| 13 | Parent portal | `/parent` | parent | future |

> "API ready" = backend endpoints exist and are tested; the screen is a thin
> client away. The MVP ships the highest-frequency screens first.

## Layout

- **Left sidebar** (role-filtered nav) + scrollable content area.
- **Stat cards** on dashboards (big number + sub-label).
- **Tables** with server pagination, search, and status **badges** (color-coded:
  green=good, amber=warn, red=risk/overdue).

## Dashboard (admin) — content

Total students · Active students · Active teachers · Today's attendance % ·
At-risk count (high/critical) · Expected / Collected / Overdue revenue ·
Recent activity (from the audit log).

## Attendance UX principles

1. **Three inputs, then done**: group → date → tap statuses → Save.
2. **Pre-filled**: re-opening a saved day shows existing marks.
3. **Bulk shortcut**: "All present" then fix exceptions.
4. **One save**: all rows persist in a single request/transaction.
5. **Mobile-first**: large tap targets (P/A/L/E buttons), minimal scrolling.

## Visual language

- Neutral slate background, white cards, single dark primary color.
- Status colors are consistent across the app (a red badge always means trouble).
- Typography: system font stack; numbers emphasized on dashboards.

## Accessibility / responsiveness

- Grid collapses from 4 → 2 columns on small screens.
- Buttons have titles; color is paired with text labels (status codes P/A/L/E),
  not color alone.
