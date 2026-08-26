# DAKSYNC — Postman Field App (Flutter)

The postman-facing mobile app of DAKSYNC for India Post. A postman signs in to their regional beat, views today's AI-optimized delivery run sheet, follows GPS map navigation to each delivery address, and completes verified handovers via OTP.

---

## Key Features

1. **Multi-Region & Regional Beat Access**:
   - Supports postmen across all 6 postal hubs (`NSK-HO`, `NSK-RD`, `BOM-GPO`, `BOM-AND`, `PUN-HO`, `NGP-GPO`).
   - 1-tap regional login selector on the sign-in screen.
   - Header displays the postman's assigned regional office and serving PIN code.

2. **GPS Map Navigation & Next Delivery Routing**:
   - **Next Delivery Action Card**: Prominently highlights the immediate next delivery stop, ETA, recipient phone, and confirmed delivery window.
   - **1-Click GPS Navigation**: Directly launches Google Maps / Navigation app with two-wheeler turn-by-turn routing to the recipient's coordinates.
   - **Interactive Route Map View**: Modal route viewer displaying all sequenced stops in order with distances and timeline.
   - **Multi-Stop Turn-by-Turn**: Postman can open the entire day's run sheet in Google Maps with all waypoints preloaded.

3. **OTP-Verified Delivery Flow**:
   - **Start Delivery**: Sends SMS/In-app OTP to the customer and switches status to `OUT_FOR_DELIVERY`.
   - **Demo OTP Presentation**: In demo mode, OTP is displayed on screen for live evaluation and judging.
   - **Verification & Handover**: Enforces 4-digit code verification with attempt limits before marking as `DELIVERED`.
   - **Exception Handling**: Postman can record delivery failures with standard India Post failure codes (`RECIPIENT_UNAVAILABLE`, `DOOR_LOCKED`, `WRONG_ADDRESS`, etc.).

---

## Demo Postmen Accounts (Password: `post123`)

| Region / Hub | Postman Name | Email |
| :--- | :--- | :--- |
| **Nashik City HO** | Ramesh Gaikwad | `postman1@daksync.in` |
| **Nashik Road** | Dinesh More | `postman4@daksync.in` |
| **Mumbai GPO** | Vikram Shinde | `postman6@daksync.in` |
| **Mumbai Andheri HO** | Pradeep Kadam | `postman8@daksync.in` |
| **Pune Head Post Office** | Pravin Joshi | `postman10@daksync.in` |
| **Nagpur General Post Office** | Anand Raut | `postman12@daksync.in` |

*(All 14 postmen `postman1@daksync.in` through `postman14@daksync.in` share the password `post123`)*

---

## Running the App

```bash
cd mobile
flutter pub get

# Web mode (simplest for browser demo):
flutter run -d chrome

# Android Emulator:
flutter run --dart-define=API_BASE=http://10.0.2.2:8000

# Physical Device on local Wi-Fi:
flutter run --dart-define=API_BASE=http://<YOUR_IP>:8000
```
