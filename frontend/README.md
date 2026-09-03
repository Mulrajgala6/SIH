# DAKSYNC — Web Frontend

Bilingual (English / हिन्दी) Next.js 14 UI for the DAKSYNC India Post
delivery-scheduling prototype (SIH 2026). It talks to the FastAPI backend
described in [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md).

## Stack & all the constraints

- **Next.js 14** (App Router, `src/app`), **React 18**, **TypeScript** (strict).
- **Tailwind CSS** for styling with the India Post design tokens in
  `tailwind.config.ts` (`brand-*`, `accent`, `ink`).
- **No other runtime dependencies.** i18n, auth, the API client, icons and the
  slot-distribution chart are all hand-rolled. Fonts (Inter + Noto Sans
  Devanagari) load via `next/font/google`, which ships with Next.

## Running

```bash
cd frontend
npm install          # first time only
npm run dev          # http://localhost:3000
```

The backend must be running on **http://localhost:8000** (default). To point at
a different host, copy `.env.local.example` to `.env.local` and set:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the backend from `../backend` with `uvicorn app.main:app --reload` and
make sure the seed has run so the demo logins and slots exist.

## Demo logins

| Role       | Email                   | Password   | Lands on            |
|------------|-------------------------|------------|---------------------|
| Admin      | `admin@daksync.in`      | `admin123` | `/dashboard`        |
| Supervisor | `supervisor@daksync.in` | `super123` | `/dashboard`        |
| Postman    | `postman1@daksync.in`   | `post123`  | field-app notice¹   |

¹ Postmen deliver through the DAKSYNC **Flutter field app**; the web login shows
a note pointing them there instead of the supervisor-only dashboard.
Senders (if seeded) land on `/consignments/new`. On the login screen you can tap
a demo row to auto-fill the form.

## Routes

| Route                   | Access                     | Purpose |
|-------------------------|----------------------------|---------|
| `/`                     | Public                     | Landing: hero, role entry cards, 7-step pipeline, live backend health check. |
| `/login`                | Public                     | Email/password sign-in with demo-credential shortcuts; role-based redirect. |
| `/track`                | Public                     | Enter a tracking number to see status timeline, confirmed slot and address. |
| `/track/[tracking]`     | Public                     | Shareable deep-link version of the tracking view. |
| `/confirm/[id]`         | Public (recipient)         | **Centrepiece.** Recipient picks a delivery slot; recommended option is badged with a friendly reason. Never shows numeric scores. |
| `/consignments/new`     | SENDER, SUPERVISOR, ADMIN  | Booking form (`ConsignmentCreate`); on success shows tracking number + shareable `/confirm/{id}` link with a copy button. |
| `/consignments/[id]`    | SUPERVISOR, ADMIN          | Full consignment detail: parcel, slot history, sender/recipient, address, and quick status/priority PATCH controls. |
| `/dashboard`            | SUPERVISOR, ADMIN          | Control room: KPIs, slot-distribution bars, status breakdown, searchable/filterable consignments table, route optimizer, and expandable route timelines. |

## How it is organised

```
src/
  app/                      App Router pages (see table above)
    layout.tsx              Fonts (Inter, Noto Devanagari) + <Providers>
    globals.css             Light theme, .card / .section-title helpers
  components/
    Nav.tsx                 Auth-aware top bar + LanguageToggle + logout
    Providers.tsx           I18nProvider → AuthProvider
    Button.tsx  Field.tsx  Spinner.tsx  KpiCard.tsx  StatusBadge.tsx
    SlotCard.tsx            Large tappable slot card for /confirm
    TrackExplorer.tsx       Shared tracking search + result/timeline
  lib/
    api.ts                  Typed client for every endpoint + apiFetch + helpers
    i18n.tsx                Hand-rolled EN/HI context, t(), LanguageToggle
    auth.tsx                Auth context, useAuth(), <RequireRole>
```

## i18n

`useI18n()` gives `{ lang, setLang, t }`. `t("nav.login")` looks up a dot-path in
the bilingual dictionary in `lib/i18n.tsx`; the English and Hindi trees are kept
in structural sync at compile time. The chosen language is stored in
`localStorage` (`daksync_lang`). For API data that already ships bilingually
(`label_en`/`label_hi`, `reason_en`/`reason_hi`) use `pickLang(lang, en, hi)`.
Hindi text is rendered with the `font-hindi` (Noto Sans Devanagari) family;
pages add that class at their root when `lang === "hi"`.

## Auth

`useAuth()` exposes `{ user, token, ready, login, logout }`. The token and user
are persisted in `localStorage` (`daksync_token`, `daksync_user`) and the
profile is refreshed via `/auth/me` on load. Wrap staff pages in
`<RequireRole roles={[...]}>`: it waits for hydration, redirects anonymous
visitors to `/login`, and shows a friendly "not authorized" panel on role
mismatch.
```
