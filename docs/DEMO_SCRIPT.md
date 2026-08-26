# DAKSYNC — Demo Script

A tight ~5-minute walkthrough that shows the whole loop: **recipient chooses a
slot → AI recommends → route is optimized → postman delivers with OTP →
analytics update.** Timings are a guide; the four acts are the important part.

---

## 0 · Pre-flight (do this before you present)

Three terminals.

```bash
# ① Backend
cd backend && source .venv/bin/activate      # Windows: .venv\Scripts\activate
python -m app.db.seed                        # fresh, deterministic demo data
uvicorn app.main:app --reload --port 8000

# ② Frontend
cd frontend && npm run dev                   # http://localhost:3000

# ③ Postman app (optional but recommended)
cd mobile && flutter run -d chrome           # backend must be on the same host
```

Sanity checks: <http://localhost:8000/health> returns `{"status":"ok"}`, and the
landing page shows the backend as connected.

**Demo logins**

| Role | Email | Password |
| --- | --- | --- |
| Supervisor | `supervisor@daksync.in` | `super123` |
| Postman | `postman1@daksync.in` | `post123` |
| Admin | `admin@daksync.in` | `admin123` |

**Grab two IDs you'll need** (either from the dashboard's consignment list, or):

```bash
# a consignment still awaiting the recipient's choice (for Act 1)
curl -s "http://localhost:8000/api/v1/consignments?status=SLOT_PENDING" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

The seed always includes at least one `SLOT_PENDING` "changer" consignment set up
specifically for the *recipient-changes-their-slot* moment. Note its `id` (for
the confirm link) and `tracking_number` (for public tracking).

> Get `$TOKEN`: `POST /api/v1/auth/login` with the supervisor creds returns
> `access_token`. Or just use the web dashboard — it does this for you.

---

## Act 1 · The recipient chooses (≈75s) — *customer control + bilingual + AI*

1. Open **`/confirm/<consignment_id>`** (no login — recipients have no account;
   the link itself is the capability).
2. Toggle **EN ⇄ हिन्दी** in the corner. *"The whole recipient experience is
   bilingual — this matters for India Post's reach."*
3. Point at the **recommended slot**. *"We recommend the slot this recipient has
   historically accepted — but notice we show a plain reason, never a raw
   probability or 'confidence score' to the customer."*
4. **Change** the slot to a different window and confirm.

**Say:** *"Feasibility is decided by rules — agent hours and slot windows — and
the model only ranks the slots that are actually deliverable. The recipient is
always in control; the AI just makes the common case one tap."*

---

## Act 2 · The supervisor plans (≈75s) — *optimization*

1. Sign in at **`/login`** as the **supervisor** → **`/dashboard`**.
2. Trigger **Optimize routes** (`POST /api/v1/routes/optimize`). *"This builds
   today's routes from every confirmed slot."*
3. Open a route. *"Stops are sequenced to respect each recipient's chosen time
   window, with ETAs and distances. We use Google OR-Tools' VRPTW solver when
   it's installed, and a built-in nearest-neighbour + 2-opt optimizer as a
   dependency-free fallback — the app never hard-fails on a missing library."*

**Say:** *"The optimizer turns customer choices into an efficient, feasible run
sheet — that's how we lift first-attempt success without more trips."*

---

## Act 3 · The postman delivers (≈90s) — *OTP-verified delivery*

In the **postman app** (signed in as `postman1`):

1. Open **My routes** → the route → the first **stop**.
2. **Start delivery.** The **Demo OTP** appears in a highlighted card. *"In
   production this OTP goes to the recipient by SMS/WhatsApp; in demo mode we
   surface it on-screen so you can see the whole flow. The OTP expires and is
   single-use — the app never stores or decides it; the server verifies it."*
3. Enter the OTP → **Verify** → **Complete delivery**.
4. *(Optional)* On another stop, show **Mark failed** with a reason
   (recipient unavailable / wrong address / refused). *"Failures are first-class
   — they feed the analytics and a real reschedule."*

**Say:** *"OTP verification is the proof-of-delivery. Try a wrong code first — it
shows attempts remaining and blocks completion until a valid OTP is verified."*

---

## Act 4 · The payoff (≈45s) — *live analytics*

1. Back to the web **`/dashboard`** (refresh).
2. Point at **first-attempt success rate**, **delivered today**, and the
   **slot distribution**. *"These are computed live from the same events we just
   generated — deliver a parcel, the number moves."*

**Say:** *"That first-attempt success rate is the metric this problem is really
about — every earlier step, the slot choice, the recommendation, the optimized
route, exists to move that number."*

---

## If something goes sideways

- **No routes for the postman?** You skipped Act 2 — routes only exist after
  `POST /routes/optimize`. Optimize, then pull-to-refresh in the app.
- **Recipient link 404s?** Use a consignment `id` that is still `SLOT_PENDING`
  (see pre-flight), not a tracking number.
- **Want a clean slate mid-demo?** Re-run `python -m app.db.seed` (deterministic)
  and refresh.
- **OR-Tools not installed?** Expected — the fallback optimizer runs
  automatically and the demo is identical. (`pip install -r
  requirements-optional.txt` if you want the solver.)

---

## What to emphasize for judges

- **Customer control first** — the recipient picks the window; the AI assists,
  never overrides.
- **Rules decide feasibility; the model only ranks** — safe, explainable,
  no black-box promises to customers (probabilities are never exposed).
- **First-attempt success** is the north-star metric, shown live.
- **Runs anywhere** — zero-config SQLite, pure-Python recommender and optimizer;
  OR-Tools / PostgreSQL / online geocoding are optional upgrades.
- **Bilingual (EN / हिन्दी)** throughout the recipient and field experience.
- **Real security posture even in a prototype** — hashed passwords, role-guarded
  staff endpoints, expiring single-use OTPs, minimal recipient data exposure.
