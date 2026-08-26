# DAKSYNC — Postman Field App (Flutter)

The postman-facing half of DAKSYNC. A postman signs in, sees the routes assigned
to them for the day (ordered stops with ETAs and confirmed delivery slots), and
works each stop through an OTP-verified delivery flow.

This app talks to the same FastAPI backend as the web console — see
`../docs/API_CONTRACT.md` for the endpoints it uses (`/auth/login`, `/routes`,
`/routes/{id}`, `/deliveries/*`).

## What it does

- **Sign in** as a postman (role-guarded token from `/auth/login`).
- **My routes** — today's run sheets, with stop count, distance, planned start,
  and a delivered/total progress bar. Pull to refresh.
- **Route detail** — the ordered stops (run sheet): sequence, recipient, address,
  ETA, confirmed slot (bilingual, e.g. "Evening · शाम"), and per-stop status.
- **Delivery flow** — per stop: **Start delivery** → the backend mints a
  one-time password; in demo mode it's shown on-screen in a highlighted
  *"Demo OTP (shown for presentation)"* card so you can present without a real
  SMS gateway. Enter the OTP → **Verify** (shows attempts remaining on a wrong
  code) → **Complete delivery**. A **Mark as failed** path captures a reason
  (recipient unavailable / wrong address / refused / other) and optional notes.

The OTP is validated server-side (expiry + single-use); the app never sees the
stored hash and never decides verification itself.

## Run it

Prerequisites: Flutter SDK (3.x), and the DAKSYNC backend running (default
`http://localhost:8000`).

```bash
cd mobile
flutter pub get

# Flutter web (simplest for a laptop demo — backend on the same machine):
flutter run -d chrome

# Android emulator (localhost on the host is 10.0.2.2 from inside the emulator):
flutter run --dart-define=API_BASE=http://10.0.2.2:8000

# A physical device on the same Wi-Fi (use your laptop's LAN IP):
flutter run --dart-define=API_BASE=http://192.168.1.50:8000
```

The API base URL is a compile-time define (`API_BASE`), defaulting to
`http://localhost:8000`. The `/api/v1` prefix is fixed in `lib/config.dart`.

## Demo login

```
postman1@daksync.in · post123   (postman1 … postman4)
```

Routes only appear once a supervisor has optimized routes for the day in the web
console, so the delivery loop is: seed data → supervisor optimizes → postman
delivers here.

## Project layout

```
lib/
  config.dart              API base URL + time formatting
  main.dart                MaterialApp (Material 3, India Post blue) + provider
  models/models.dart       response models (mirror API_CONTRACT.md)
  services/api_client.dart REST client + ApiException
  state/app_state.dart     auth + routes (ChangeNotifier)
  screens/
    login_screen.dart
    routes_screen.dart      today's routes
    route_detail_screen.dart ordered stops
    delivery_screen.dart    start → OTP → complete / fail
  widgets/
    primary_button.dart
    status_chip.dart
    otp_input.dart
```

Dependencies are deliberately minimal: `http` and `provider` only.
