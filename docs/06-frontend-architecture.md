# EOS — Frontend Architecture (Next.js)

## Folder structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # root layout, wraps AuthProvider
│   │   ├── page.tsx            # redirects to /dashboard or /login
│   │   ├── globals.css
│   │   ├── login/page.tsx      # public sign-in
│   │   └── (app)/              # authenticated route group
│   │       ├── layout.tsx      # guards session + renders Sidebar
│   │       ├── dashboard/page.tsx
│   │       ├── students/page.tsx
│   │       ├── attendance/page.tsx
│   │       ├── payments/page.tsx
│   │       └── risk/page.tsx
│   ├── components/
│   │   ├── sidebar.tsx         # role-aware navigation
│   │   └── ui/                 # ShadCN-style primitives
│   │       ├── button.tsx  card.tsx  input.tsx  badge.tsx
│   └── lib/
│       ├── api.ts              # fetch client + token refresh
│       ├── auth.tsx            # AuthProvider + useAuth()
│       └── utils.ts            # cn(), formatMoney(), formatDate()
├── Dockerfile
├── next.config.mjs             # output: 'standalone'
├── tailwind.config.ts
└── package.json
```

## Patterns

- **App Router** with a `(app)` route group whose layout enforces auth and shows
  the sidebar. Unauthenticated users are redirected to `/login`.
- **Auth**: `AuthProvider` restores the session via `/auth/me`; tokens live in
  `localStorage`. `api.ts` transparently refreshes the access token once on a 401
  using the rotating refresh token, then retries the request.
- **Role-aware UI**: the sidebar filters items by role; financial pages
  (Payments, At-Risk) are hidden from teachers (and the backend enforces it too).
- **Data fetching**: client components call the typed `api` helper. Lists are
  server-paginated and debounce search input.
- **Styling**: Tailwind + small hand-written primitives that mirror ShadCN's API
  (`Button` via `cva`, `Card`, `Input`, `Badge`). Easy to swap for the full
  ShadCN registry later.

## Why client-side auth (for now)

For an internal admin tool at this scale, `localStorage` tokens + a refresh
interceptor are simple and sufficient. The clean upgrade path is httpOnly cookie
sessions with Next.js middleware for SSR-guarded routes — the `api.ts` boundary
keeps that change localized.

## Key screen: Attendance (the hot path)

`attendance/page.tsx` is optimized for speed: pick group + date, the roster loads
pre-filled, one tap sets P/A/L/E per student (or "All present"), and one button
saves every record in a single request. Designed to be usable one-handed on a
phone at the start of class.
