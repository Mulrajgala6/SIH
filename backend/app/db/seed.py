"""Seed DAKSYNC with a realistic Nashik-based demo dataset.

Run with:  ``python -m app.db.seed``   (resets the DB, then seeds)

What it creates
---------------
* 4 delivery slots (Morning / Midday / Afternoon / Evening), bilingual labels
* 2 post offices (Nashik City HO, Nashik Road)
* Demo users: 1 admin, 1 supervisor, 4 postmen (linked to delivery agents)
* A handful of senders (couriers/banks/retailers)
* ~18 recipients across Nashik localities, each with a *behaviour pattern*
  (used only to generate realistic history — never shown to customers)
* ~40 historical consignments + delivery attempts, where success correlates
  with the recipient's preferred slot → real training signal for the Phase-4
  recommender
* ~18 active consignments dated today (mostly SLOT_CONFIRMED so a route can be
  built in Phase 6; a few SLOT_PENDING awaiting the recipient), plus OTPs and
  in-app notifications

The dataset is deterministic (fixed RNG seed) so demos are reproducible.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.db.init_db import reset
from app.db.session import SessionLocal
from app.models.entities import (
    Address,
    Consignment,
    DeliveryAgent,
    DeliveryAttempt,
    DeliverySlot,
    Notification,
    OTPVerification,
    PostOffice,
    Recipient,
    Sender,
    SlotPreference,
    User,
)
from app.models.enums import (
    AttemptOutcome,
    ConsignmentStatus,
    FailureReason,
    NotificationChannel,
    NotificationType,
    PreferenceType,
    Priority,
    Role,
    SlotCode,
)
from app.utils.otp import generate_otp
from app.utils.tracking import generate_tracking_number

RNG = random.Random(4242)  # deterministic demo data


# --------------------------------------------------------------------------- #
# Static demo reference data
# --------------------------------------------------------------------------- #
# Approximate coordinates for Nashik localities (lat, lng).
LOCALITIES: dict[str, tuple[float, float]] = {
    "Panchavati": (20.0110, 73.7929),
    "College Road": (19.9975, 73.7570),
    "Gangapur Road": (20.0050, 73.7500),
    "Indira Nagar": (19.9720, 73.7680),
    "CIDCO": (19.9640, 73.7480),
    "Mahatma Nagar": (19.9880, 73.7420),
    "Govind Nagar": (19.9790, 73.7620),
    "Adgaon": (20.0430, 73.8290),
    "Satpur": (19.9990, 73.7150),
    "Deolali": (19.9440, 73.8300),
    "Nashik Road": (19.9450, 73.8380),
    "Old Nashik": (19.9930, 73.7960),
}

# code -> (label_en, label_hi, start_minutes, end_minutes, sort_order)
SLOTS: dict[SlotCode, tuple[str, str, int, int, int]] = {
    SlotCode.MORNING: ("Morning (10 AM – 12 PM)", "सुबह (10 – 12 बजे)", 600, 720, 1),
    SlotCode.MIDDAY: ("Midday (12 – 2 PM)", "दोपहर (12 – 2 बजे)", 720, 840, 2),
    SlotCode.AFTERNOON: ("Afternoon (2 – 4 PM)", "अपराह्न (2 – 4 बजे)", 840, 960, 3),
    SlotCode.EVENING: ("Evening (5 – 7 PM)", "शाम (5 – 7 बजे)", 1020, 1140, 4),
}

# post office: (code, name, pincode, lat, lng)
POST_OFFICES = [
    ("NSK-HO", "Nashik City Head Post Office", "422001", 19.9975, 73.7898),
    ("NSK-RD", "Nashik Road Post Office", "422101", 19.9450, 73.8380),
]

# Which post office serves which locality.
PO_FOR_LOCALITY = {
    "Deolali": "NSK-RD",
    "Nashik Road": "NSK-RD",
    "Adgaon": "NSK-RD",
}
DEFAULT_PO = "NSK-HO"

# Behaviour archetype -> preferred slot code (None = cold start, no history).
ARCHETYPE_SLOT: dict[str, SlotCode | None] = {
    "MORNING_PERSON": SlotCode.MORNING,
    "MIDDAY_PERSON": SlotCode.MIDDAY,
    "AFTERNOON_PERSON": SlotCode.AFTERNOON,
    "EVENING_PERSON": SlotCode.EVENING,
    "CHANGER": SlotCode.MORNING,   # requests morning; changes to evening in demo
    "COLDSTART": None,
}

# recipient: (name, locality, language, archetype)
RECIPIENTS = [
    ("Aarti Deshmukh", "Panchavati", "hi", "MORNING_PERSON"),
    ("Rohan Kulkarni", "College Road", "en", "EVENING_PERSON"),
    ("Sneha Patil", "Gangapur Road", "en", "EVENING_PERSON"),
    ("Vikram Jadhav", "Indira Nagar", "hi", "AFTERNOON_PERSON"),
    ("Priya Sharma", "CIDCO", "en", "MIDDAY_PERSON"),
    ("Amit Pawar", "Mahatma Nagar", "hi", "MORNING_PERSON"),
    ("Neha Joshi", "Govind Nagar", "en", "EVENING_PERSON"),
    ("Sagar Wagh", "Adgaon", "hi", "AFTERNOON_PERSON"),
    ("Pooja More", "Satpur", "en", "MORNING_PERSON"),
    ("Kiran Shinde", "Deolali", "hi", "EVENING_PERSON"),
    ("Manish Gupta", "Nashik Road", "en", "MIDDAY_PERSON"),
    ("Divya Rao", "Old Nashik", "en", "AFTERNOON_PERSON"),
    ("Sunil Ahire", "Panchavati", "hi", "EVENING_PERSON"),
    ("Rekha Bhosale", "College Road", "hi", "MORNING_PERSON"),
    ("Tejas Sonawane", "CIDCO", "en", "CHANGER"),
    ("Anjali Nair", "Gangapur Road", "en", "COLDSTART"),
    ("Farhan Shaikh", "Indira Nagar", "hi", "COLDSTART"),
    ("Meera Kulkarni", "Govind Nagar", "en", "AFTERNOON_PERSON"),
]

# sender: (name, organization)
SENDERS = [
    ("Flipkart Logistics", "Flipkart"),
    ("Amazon India", "Amazon"),
    ("State Bank of India", "SBI"),
    ("Reliance Digital", "Reliance"),
    ("Rahul Verma", None),  # an individual sender
]

# agent: (full_name, email, po_code)
AGENTS = [
    ("Ramesh Gaikwad", "postman1@daksync.in", "NSK-HO"),
    ("Suresh Patil", "postman2@daksync.in", "NSK-HO"),
    ("Ganesh Jadhav", "postman3@daksync.in", "NSK-HO"),
    ("Dinesh More", "postman4@daksync.in", "NSK-RD"),
]

PARCEL_DESCRIPTIONS = [
    "Documents", "Electronics", "Clothing", "Books", "Bank card",
    "Medicines", "Mobile accessory", "Cosmetics", "Gift", "Kitchenware",
]


def _jitter(coord: tuple[float, float]) -> tuple[float, float]:
    """Small random offset so co-located recipients don't stack on one pin."""
    lat, lng = coord
    return (lat + RNG.uniform(-0.004, 0.004), lng + RNG.uniform(-0.004, 0.004))


def _phone() -> str:
    return "9" + "".join(str(RNG.randint(0, 9)) for _ in range(9))


def _today_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, now.day, tzinfo=timezone.utc)


# --------------------------------------------------------------------------- #
# Seeding
# --------------------------------------------------------------------------- #
def seed(verbose: bool = True) -> dict[str, int]:
    reset()
    counts: dict[str, int] = {}
    tracking_seq = 100_000

    with SessionLocal() as db:
        # -- Slots --------------------------------------------------------- #
        slots: dict[SlotCode, DeliverySlot] = {}
        for code, (en, hi, start, end, order) in SLOTS.items():
            slot = DeliverySlot(
                code=code, label_en=en, label_hi=hi,
                start_minutes=start, end_minutes=end, sort_order=order,
            )
            db.add(slot)
            slots[code] = slot
        db.flush()
        counts["slots"] = len(slots)

        # -- Post offices -------------------------------------------------- #
        offices: dict[str, PostOffice] = {}
        for code, name, pincode, lat, lng in POST_OFFICES:
            po = PostOffice(code=code, name=name, pincode=pincode, latitude=lat, longitude=lng)
            db.add(po)
            offices[code] = po
        db.flush()
        counts["post_offices"] = len(offices)

        # -- Staff users + agents ----------------------------------------- #
        db.add(User(
            email="admin@daksync.in", hashed_password=hash_password("admin123"),
            full_name="System Admin", role=Role.ADMIN, phone=_phone(),
        ))
        db.add(User(
            email="supervisor@daksync.in", hashed_password=hash_password("super123"),
            full_name="Nashik Supervisor", role=Role.SUPERVISOR, phone=_phone(),
        ))
        agents: list[DeliveryAgent] = []
        for full_name, email, po_code in AGENTS:
            user = User(
                email=email, hashed_password=hash_password("post123"),
                full_name=full_name, role=Role.POSTMAN, phone=_phone(),
            )
            db.add(user)
            db.flush()
            agent = DeliveryAgent(
                user_id=user.id, post_office_id=offices[po_code].id,
                name=full_name, phone=user.phone,
            )
            db.add(agent)
            agents.append(agent)
        db.flush()
        counts["users"] = 2 + len(AGENTS)
        counts["agents"] = len(agents)

        # -- Senders ------------------------------------------------------- #
        senders: list[Sender] = []
        for name, org in SENDERS:
            s = Sender(name=name, organization=org, phone=_phone())
            db.add(s)
            senders.append(s)
        db.flush()
        counts["senders"] = len(senders)

        # -- Recipients + addresses --------------------------------------- #
        recipients: list[tuple[Recipient, Address, str]] = []
        for name, locality, lang, archetype in RECIPIENTS:
            r = Recipient(
                name=name, phone=_phone(), preferred_language=lang,
                behaviour_note=archetype,
            )
            db.add(r)
            db.flush()
            lat, lng = _jitter(LOCALITIES[locality])
            po_code = PO_FOR_LOCALITY.get(locality, DEFAULT_PO)
            addr = Address(
                recipient_id=r.id,
                line1=f"{RNG.randint(1, 200)}, {locality}",
                line2=RNG.choice(["Near Bus Stop", "Opp. Temple", "2nd Lane", "Main Road"]),
                locality=locality, pincode=offices[po_code].pincode,
                latitude=lat, longitude=lng, is_geocoded=True,
            )
            db.add(addr)
            db.flush()
            recipients.append((r, addr, archetype))
        counts["recipients"] = len(recipients)
        counts["addresses"] = len(recipients)

        # -- Historical consignments (training signal) -------------------- #
        history_count = 0
        attempts_count = 0
        all_slot_codes = list(SLOTS.keys())
        for r, addr, archetype in recipients:
            preferred = ARCHETYPE_SLOT[archetype]
            if preferred is None:
                continue  # cold-start recipients have no history
            po_code = PO_FOR_LOCALITY.get(addr.locality, DEFAULT_PO)
            for _ in range(3):
                slot_code = RNG.choice(all_slot_codes)
                # Success correlates with the preferred slot (+10% noise).
                success = (slot_code == preferred)
                if RNG.random() < 0.10:
                    success = not success
                days_ago = RNG.randint(5, 45)
                deliver_dt = _today_utc() - timedelta(days=days_ago)
                slot = slots[slot_code]
                cons = Consignment(
                    tracking_number=generate_tracking_number(tracking_seq),
                    sender_id=RNG.choice(senders).id,
                    recipient_id=r.id, address_id=addr.id,
                    post_office_id=offices[po_code].id,
                    status=ConsignmentStatus.DELIVERED if success
                    else ConsignmentStatus.DELIVERY_FAILED,
                    priority=Priority.NORMAL,
                    description=RNG.choice(PARCEL_DESCRIPTIONS),
                    weight_grams=RNG.randint(100, 3000),
                    requested_slot_id=slot.id, confirmed_slot_id=slot.id,
                    delivery_date=deliver_dt,
                )
                db.add(cons)
                db.flush()
                tracking_seq += 1
                history_count += 1

                db.add(SlotPreference(
                    consignment_id=cons.id, slot_id=slot.id,
                    preference_type=PreferenceType.RECIPIENT_CONFIRMED, source="history",
                ))
                db.add(DeliveryAttempt(
                    consignment_id=cons.id, agent_id=RNG.choice(agents).id,
                    outcome=AttemptOutcome.SUCCESS if success else AttemptOutcome.FAILED,
                    failure_reason=None if success else FailureReason.RECIPIENT_UNAVAILABLE,
                    notes=None if success else "Recipient not available at attempted time.",
                    attempted_at=deliver_dt,
                ))
                attempts_count += 1
        counts["historical_consignments"] = history_count
        counts["delivery_attempts"] = attempts_count

        # -- Active consignments (today) ---------------------------------- #
        today = _today_utc()
        active_count = 0
        otp_count = 0
        notif_count = 0
        # A few recipients await recipient action (SLOT_PENDING).
        pending_indices = {rec_i for rec_i, (_, _, a) in enumerate(recipients)
                           if a == "COLDSTART"}
        pending_indices.update({1, 4})  # two extra confirmed→pending for demo variety

        for idx, (r, addr, archetype) in enumerate(recipients):
            preferred = ARCHETYPE_SLOT[archetype]
            po_code = PO_FOR_LOCALITY.get(addr.locality, DEFAULT_PO)
            sender = RNG.choice(senders)
            base = dict(
                tracking_number=generate_tracking_number(tracking_seq),
                sender_id=sender.id, recipient_id=r.id, address_id=addr.id,
                post_office_id=offices[po_code].id,
                priority=RNG.choices([Priority.NORMAL, Priority.HIGH, Priority.URGENT],
                                     weights=[7, 2, 1])[0],
                description=RNG.choice(PARCEL_DESCRIPTIONS),
                weight_grams=RNG.randint(100, 3000),
                delivery_date=today,
            )
            tracking_seq += 1

            if idx in pending_indices or preferred is None:
                # Awaiting recipient's slot choice / recommendation.
                requested = slots[preferred] if preferred else None
                cons = Consignment(
                    **base, status=ConsignmentStatus.SLOT_PENDING,
                    requested_slot_id=requested.id if requested else None,
                )
                db.add(cons)
                db.flush()
                db.add(Notification(
                    recipient_id=r.id, consignment_id=cons.id,
                    type=NotificationType.SLOT_REQUEST, channel=NotificationChannel.IN_APP,
                    title_en="Choose your delivery time",
                    title_hi="अपना डिलीवरी समय चुनें",
                    body_en=f"Parcel {cons.tracking_number} is ready. Please pick a slot.",
                    body_hi=f"पार्सल {cons.tracking_number} तैयार है। कृपया समय चुनें।",
                ))
                notif_count += 1
            else:
                # Confirmed for the recipient's preferred slot → routable today.
                slot = slots[preferred]
                cons = Consignment(
                    **base, status=ConsignmentStatus.SLOT_CONFIRMED,
                    requested_slot_id=slot.id, recommended_slot_id=slot.id,
                    confirmed_slot_id=slot.id,
                )
                db.add(cons)
                db.flush()
                db.add(SlotPreference(
                    consignment_id=cons.id, slot_id=slot.id,
                    preference_type=PreferenceType.RECIPIENT_CONFIRMED, source="recipient",
                ))
                # Seed a fresh, unused OTP (valid 24h) for the delivery demo.
                db.add(OTPVerification(
                    consignment_id=cons.id, code=generate_otp(4),
                    expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
                ))
                otp_count += 1
                db.add(Notification(
                    recipient_id=r.id, consignment_id=cons.id,
                    type=NotificationType.SCHEDULED, channel=NotificationChannel.IN_APP,
                    title_en="Delivery scheduled",
                    title_hi="डिलीवरी निर्धारित",
                    body_en=f"Parcel {cons.tracking_number} will arrive in the {slot.label_en}.",
                    body_hi=f"पार्सल {cons.tracking_number} {slot.label_hi} में आएगा।",
                ))
                notif_count += 1
            active_count += 1

        counts["active_consignments"] = active_count
        counts["otps"] = otp_count
        counts["notifications"] = notif_count

        db.commit()

    if verbose:
        print("DAKSYNC seed complete:")
        for key in sorted(counts):
            print(f"  {key:>26}: {counts[key]}")
        print("\nDemo logins:")
        print("  admin@daksync.in / admin123")
        print("  supervisor@daksync.in / super123")
        print("  postman1@daksync.in / post123  (also postman2..4)")
    return counts


if __name__ == "__main__":
    seed()
