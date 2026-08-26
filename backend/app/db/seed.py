"""DAKSYNC 6-Region Complete Seed Dataset.

Initializes fresh, comprehensive data across 6 Maharashtra postal regions:
  1. Nashik City Head Post Office (NSK-HO, 422001)
  2. Nashik Road Post Office (NSK-RD, 422101)
  3. Mumbai General Post Office (BOM-GPO, 400001)
  4. Andheri Head Post Office (BOM-AND, 400069)
  5. Pune Head Post Office (PUN-HO, 411001)
  6. Nagpur General Post Office (NGP-GPO, 440001)

Provides:
  - 14 Delivery Postmen (at least 2 in each office) with multi-carrier beat partitioning
  - 6 Regional Supervisors + Global Admin + Customer Senders/Recipients
  - Rich, distinct recipient directory with realistic addresses (zero duplicate names or locations)
  - 250+ Historical consignments for ML slot prediction training
  - Active deliverable consignments & inter-region transit bags
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
    NotificationChannel,
    NotificationType,
    PreferenceType,
    Priority,
    Role,
    SlotCode,
)
from app.utils.tracking import generate_tracking_number

SEED = 2026
RNG = random.Random(SEED)


def generate_otp(digits: int = 4) -> str:
    return "".join(str(RNG.randint(0, 9)) for _ in range(digits))

# --------------------------------------------------------------------------- #
# Static Reference Data
# --------------------------------------------------------------------------- #
POST_OFFICES = [
    ("NSK-HO", "Nashik City Head Post Office", "422001", 19.9975, 73.7898),
    ("NSK-RD", "Nashik Road Post Office", "422101", 19.9450, 73.8380),
    ("BOM-GPO", "Mumbai General Post Office", "400001", 18.9400, 72.8350),
    ("BOM-AND", "Andheri Head Post Office", "400069", 19.1190, 72.8460),
    ("PUN-HO", "Pune Head Post Office", "411001", 18.5204, 73.8567),
    ("NGP-GPO", "Nagpur General Post Office", "440001", 21.1500, 79.0800),
]

LOCALITIES: dict[str, tuple[float, float, str]] = {
    # Nashik City HO
    "Panchavati": (20.0110, 73.7929, "NSK-HO"),
    "College Road": (19.9975, 73.7570, "NSK-HO"),
    "Gangapur Road": (20.0050, 73.7500, "NSK-HO"),
    "Indira Nagar": (19.9720, 73.7680, "NSK-HO"),
    "Mahatma Nagar": (19.9880, 73.7420, "NSK-HO"),
    "Govind Nagar": (19.9790, 73.7620, "NSK-HO"),
    "Old Nashik": (19.9930, 73.7960, "NSK-HO"),
    "Canada Corner": (19.9950, 73.7750, "NSK-HO"),

    # Nashik Road
    "Deolali": (19.9440, 73.8300, "NSK-RD"),
    "Nashik Road Station": (19.9450, 73.8380, "NSK-RD"),
    "Adgaon": (20.0430, 73.8290, "NSK-RD"),
    "CIDCO Nashik": (19.9640, 73.7480, "NSK-RD"),
    "Upnagar": (19.9520, 73.8150, "NSK-RD"),
    "Datir Nagar": (19.9380, 73.8420, "NSK-RD"),
    "Jail Road": (19.9510, 73.8290, "NSK-RD"),
    "Muktidham": (19.9470, 73.8360, "NSK-RD"),

    # Mumbai GPO (South Mumbai)
    "Fort / GPO": (18.9390, 72.8355, "BOM-GPO"),
    "Colaba": (18.9067, 72.8147, "BOM-GPO"),
    "Nariman Point": (18.9260, 72.8230, "BOM-GPO"),
    "Marine Lines": (18.9430, 72.8230, "BOM-GPO"),
    "Churchgate": (18.9320, 72.8260, "BOM-GPO"),
    "Cuffe Parade": (18.9150, 72.8180, "BOM-GPO"),
    "Ballard Estate": (18.9350, 72.8400, "BOM-GPO"),
    "Kalbadevi": (18.9490, 72.8310, "BOM-GPO"),

    # Mumbai Andheri (Suburbs)
    "Andheri West": (19.1363, 72.8277, "BOM-AND"),
    "Andheri East": (19.1155, 72.8688, "BOM-AND"),
    "Lokhandwala": (19.1411, 72.8248, "BOM-AND"),
    "Juhu": (19.1075, 72.8263, "BOM-AND"),
    "Versova": (19.1350, 72.8140, "BOM-AND"),
    "MIDC Andheri": (19.1220, 72.8710, "BOM-AND"),
    "Chakala": (19.1120, 72.8620, "BOM-AND"),
    "Four Bungalows": (19.1290, 72.8260, "BOM-AND"),

    # Pune HO
    "Shivajinagar": (18.5314, 73.8446, "PUN-HO"),
    "Kothrud": (18.5074, 73.8077, "PUN-HO"),
    "Deccan Gymkhana": (18.5160, 73.8410, "PUN-HO"),
    "Viman Nagar": (18.5679, 73.9143, "PUN-HO"),
    "Camp Pune": (18.5130, 73.8780, "PUN-HO"),
    "Koregaon Park": (18.5360, 73.8940, "PUN-HO"),
    "Aundh": (18.5580, 73.8070, "PUN-HO"),
    "Swargate": (18.5010, 73.8580, "PUN-HO"),

    # Nagpur GPO
    "Sitabuldi": (21.1458, 79.0832, "NGP-GPO"),
    "Dharampeth": (21.1440, 79.0620, "NGP-GPO"),
    "Civil Lines Nagpur": (21.1560, 79.0720, "NGP-GPO"),
    "Ramdaspeth": (21.1350, 79.0730, "NGP-GPO"),
    "Sadar": (21.1620, 79.0840, "NGP-GPO"),
    "Dhantoli": (21.1320, 79.0810, "NGP-GPO"),
    "Wardha Road": (21.1150, 79.0680, "NGP-GPO"),
    "Gandhibagh": (21.1510, 79.1020, "NGP-GPO"),
}

SLOTS: dict[SlotCode, tuple[str, str, int, int, int]] = {
    SlotCode.MORNING: ("Morning (10 AM – 12 PM)", "सुबह (10 – 12 बजे)", 600, 720, 1),
    SlotCode.MIDDAY: ("Midday (12 – 2 PM)", "दोपहर (12 – 2 बजे)", 720, 840, 2),
    SlotCode.AFTERNOON: ("Afternoon (2 – 4 PM)", "अपराह्न (2 – 4 बजे)", 840, 960, 3),
    SlotCode.EVENING: ("Evening (5 – 7 PM)", "शाम (5 – 7 बजे)", 1020, 1140, 4),
}

SUPERVISORS = [
    ("System Admin", "admin@daksync.in", "admin123", Role.ADMIN, None),
    ("Nashik HO Supervisor", "supervisor.nsk@daksync.in", "super123", Role.SUPERVISOR, "NSK-HO"),
    ("Nashik Road Supervisor", "supervisor.nskrd@daksync.in", "super123", Role.SUPERVISOR, "NSK-RD"),
    ("Mumbai GPO Supervisor", "supervisor.bom@daksync.in", "super123", Role.SUPERVISOR, "BOM-GPO"),
    ("Andheri HO Supervisor", "supervisor.andheri@daksync.in", "super123", Role.SUPERVISOR, "BOM-AND"),
    ("Pune HO Supervisor", "supervisor.pun@daksync.in", "super123", Role.SUPERVISOR, "PUN-HO"),
    ("Nagpur GPO Supervisor", "supervisor.ngp@daksync.in", "super123", Role.SUPERVISOR, "NGP-GPO"),
    ("Default Supervisor", "supervisor@daksync.in", "super123", Role.SUPERVISOR, "NSK-HO"),
]

AGENTS = [
    # Nashik City HO (3 postmen)
    ("Ramesh Gaikwad", "postman1@daksync.in", "NSK-HO"),
    ("Suresh Patil", "postman2@daksync.in", "NSK-HO"),
    ("Ganesh Jadhav", "postman3@daksync.in", "NSK-HO"),
    # Nashik Road (2 postmen)
    ("Dinesh More", "postman4@daksync.in", "NSK-RD"),
    ("Kailash Shinde", "postman5@daksync.in", "NSK-RD"),
    # Mumbai GPO (2 postmen)
    ("Vikram Shinde", "postman6@daksync.in", "BOM-GPO"),
    ("Sachin Sawant", "postman7@daksync.in", "BOM-GPO"),
    # Mumbai Andheri HO (2 postmen)
    ("Pradeep Kadam", "postman8@daksync.in", "BOM-AND"),
    ("Sunil Parab", "postman9@daksync.in", "BOM-AND"),
    # Pune Head Post Office (2 postmen)
    ("Pravin Joshi", "postman10@daksync.in", "PUN-HO"),
    ("Nitin Kulkarni", "postman11@daksync.in", "PUN-HO"),
    # Nagpur General Post Office (3 postmen)
    ("Anand Raut", "postman12@daksync.in", "NGP-GPO"),
    ("Manoj Meshram", "postman13@daksync.in", "NGP-GPO"),
    ("Sanjay Bobde", "postman14@daksync.in", "NGP-GPO"),
]

SENDERS = [
    ("Flipkart Logistics India", "Flipkart"),
    ("Amazon Fulfillment Hub", "Amazon"),
    ("State Bank of India (Cards)", "SBI"),
    ("Reliance Digital Retail", "Reliance"),
    ("Rahul Verma", None),
]

# 48 unique recipients for local deliveries across all 6 regions (8 per region)
RECIPIENTS = [
    # Nashik City HO
    ("Aarti Deshmukh", "Panchavati", "hi", "MORNING"),
    ("Rohan Kulkarni", "College Road", "en", "EVENING"),
    ("Sneha Patil", "Gangapur Road", "en", "MORNING"),
    ("Vikram Jadhav", "Indira Nagar", "hi", "AFTERNOON"),
    ("Amit Pawar", "Mahatma Nagar", "hi", "MORNING"),
    ("Neha Joshi", "Govind Nagar", "en", "EVENING"),
    ("Divya Rao", "Old Nashik", "en", "AFTERNOON"),
    ("Harish Salve", "Canada Corner", "hi", "MIDDAY"),

    # Nashik Road
    ("Kiran Shinde", "Deolali", "hi", "EVENING"),
    ("Manish Gupta", "Nashik Road Station", "en", "MIDDAY"),
    ("Sagar Wagh", "Adgaon", "hi", "AFTERNOON"),
    ("Tejas Sonawane", "CIDCO Nashik", "en", "MORNING"),
    ("Priyanka Baste", "Upnagar", "hi", "MORNING"),
    ("Mahesh Khairnar", "Datir Nagar", "mr", "EVENING"),
    ("Sunita Bhamare", "Jail Road", "hi", "MIDDAY"),
    ("Chetan Borse", "Muktidham", "mr", "AFTERNOON"),

    # Mumbai GPO
    ("Rajesh Mehra", "Fort / GPO", "en", "MORNING"),
    ("Deepak Singhania", "Colaba", "en", "MIDDAY"),
    ("Nisha Merchant", "Nariman Point", "en", "AFTERNOON"),
    ("Harish Kapadia", "Marine Lines", "hi", "EVENING"),
    ("Kavita Shah", "Churchgate", "en", "MORNING"),
    ("Farhan Merchant", "Cuffe Parade", "en", "EVENING"),
    ("Zarina Mehta", "Ballard Estate", "en", "MIDDAY"),
    ("Bhavik Doshi", "Kalbadevi", "hi", "AFTERNOON"),

    # Mumbai Andheri
    ("Shreya Bhatt", "Andheri West", "en", "EVENING"),
    ("Rohit Shetty", "Andheri East", "hi", "MORNING"),
    ("Pooja Malhotra", "Lokhandwala", "en", "AFTERNOON"),
    ("Varun Dhawan", "Juhu", "en", "MIDDAY"),
    ("Karan Kundra", "Versova", "en", "MORNING"),
    ("Anushka Sen", "MIDC Andheri", "en", "EVENING"),
    ("Sameer Joshi", "Chakala", "hi", "MIDDAY"),
    ("Ritu Chopra", "Four Bungalows", "en", "AFTERNOON"),

    # Pune HO
    ("Nitin Gadgil", "Shivajinagar", "hi", "AFTERNOON"),
    ("Ananya Deshpande", "Kothrud", "en", "MORNING"),
    ("Siddharth Joshi", "Deccan Gymkhana", "mr", "MIDDAY"),
    ("Pooja Kulkarni", "Viman Nagar", "en", "EVENING"),
    ("Tanmay Bhave", "Camp Pune", "mr", "MORNING"),
    ("Gauri Pendse", "Koregaon Park", "en", "EVENING"),
    ("Mandar Apte", "Aundh", "mr", "AFTERNOON"),
    ("Pranav Chitale", "Swargate", "mr", "MIDDAY"),

    # Nagpur GPO
    ("Vivek Agrawal", "Sitabuldi", "hi", "MORNING"),
    ("Meena Bhowmick", "Dharampeth", "hi", "AFTERNOON"),
    ("Devendra Shukla", "Civil Lines Nagpur", "en", "MIDDAY"),
    ("Ashwin Ganorkar", "Ramdaspeth", "mr", "EVENING"),
    ("Swati Deshkar", "Sadar", "mr", "MORNING"),
    ("Pankaj Moharil", "Dhantoli", "hi", "EVENING"),
    ("Rajendra Kapse", "Wardha Road", "mr", "MIDDAY"),
    ("Shilpa Deshmukh", "Gandhibagh", "hi", "AFTERNOON"),
]

# Dedicated unique recipients for inter-region batches (so no duplicate entries)
INTER_REGION_RECIPIENTS = [
    # BOM-GPO
    ("Arnav Singhania", "Colaba", "en", "BOM-GPO"),
    ("Geeta Shroff", "Fort / GPO", "en", "BOM-GPO"),
    ("Kailash Nariman", "Nariman Point", "hi", "BOM-GPO"),
    ("Siddhesh Merchant", "Marine Lines", "en", "BOM-GPO"),
    # BOM-AND
    ("Ritesh Deshmukh", "Lokhandwala", "en", "BOM-AND"),
    ("Kavya Maran", "Andheri West", "en", "BOM-AND"),
    ("Devansh Kapadia", "Juhu", "hi", "BOM-AND"),
    ("Shraddha Nadkarni", "Versova", "en", "BOM-AND"),
    # PUN-HO
    ("Abhay Godbole", "Kothrud", "mr", "PUN-HO"),
    ("Madhura Ranade", "Shivajinagar", "mr", "PUN-HO"),
    ("Omkar Sahasrabuddhe", "Deccan Gymkhana", "mr", "PUN-HO"),
    ("Sharad Kelkar", "Camp Pune", "hi", "PUN-HO"),
    # NGP-GPO
    ("Nilesh Vaidya", "Dharampeth", "hi", "NGP-GPO"),
    ("Smita Paranjape", "Sitabuldi", "mr", "NGP-GPO"),
    ("Hemant Pande", "Civil Lines Nagpur", "hi", "NGP-GPO"),
    ("Umesh Chitnavis", "Ramdaspeth", "mr", "NGP-GPO"),
]

PARCEL_DESCRIPTIONS = [
    "Aadhaar Card Update", "Passport Documents", "Debit Card / Chequebook",
    "Electronics / Smartphone", "Prescription Medicines", "Apparel & Clothing",
    "Exam Marksheet / Certificate", "Speed Post Document", "Festival Gift Hamper",
]


def _jitter(coord: tuple[float, float]) -> tuple[float, float]:
    lat, lng = coord
    return (lat + RNG.uniform(-0.003, 0.003), lng + RNG.uniform(-0.003, 0.003))


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
        # -- 1. Slots ------------------------------------------------------ #
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

        # -- 2. Post offices ----------------------------------------------- #
        offices: dict[str, PostOffice] = {}
        for code, name, pincode, lat, lng in POST_OFFICES:
            po = PostOffice(code=code, name=name, pincode=pincode, latitude=lat, longitude=lng)
            db.add(po)
            offices[code] = po
        db.flush()
        counts["post_offices"] = len(offices)

        # -- 3. Supervisors & Admin RBAC ----------------------------------- #
        for full_name, email, pwd, role, po_code in SUPERVISORS:
            po_id = offices[po_code].id if po_code else None
            db.add(User(
                email=email, hashed_password=hash_password(pwd),
                full_name=full_name, role=role, phone=_phone(),
                post_office_id=po_id,
            ))
        db.flush()

        # Customer users
        db.add(User(
            email="sender@daksync.in", hashed_password=hash_password("user123"),
            full_name="Rahul Verma", role=Role.SENDER, phone="9820011223",
            post_office_id=offices["NSK-HO"].id,
        ))
        db.add(User(
            email="recipient@daksync.in", hashed_password=hash_password("user123"),
            full_name="Aarti Deshmukh", role=Role.RECIPIENT, phone="9812345601",
            post_office_id=offices["NSK-HO"].id,
        ))
        db.flush()

        # -- 4. Postmen Agents (at least 2 in each office) ----------------- #
        agents: list[DeliveryAgent] = []
        agents_by_po: dict[str, list[DeliveryAgent]] = {}
        for full_name, email, po_code in AGENTS:
            po = offices[po_code]
            user = User(
                email=email, hashed_password=hash_password("post123"),
                full_name=full_name, role=Role.POSTMAN, phone=_phone(),
                post_office_id=po.id,
            )
            db.add(user)
            db.flush()
            agent = DeliveryAgent(
                user_id=user.id, post_office_id=po.id,
                name=full_name, phone=user.phone,
                work_start_minutes=510,  # 08:30 AM
                work_end_minutes=1230,   # 08:30 PM (covers all delivery slots)
                daily_capacity=45,
            )
            db.add(agent)
            agents.append(agent)
            agents_by_po.setdefault(po_code, []).append(agent)
        db.flush()
        counts["users"] = len(SUPERVISORS) + 2 + len(AGENTS)
        counts["agents"] = len(agents)

        # -- 5. Senders ---------------------------------------------------- #
        senders: list[Sender] = []
        for name, org in SENDERS:
            s = Sender(name=name, organization=org, phone=_phone())
            db.add(s)
            senders.append(s)
        db.flush()
        counts["senders"] = len(senders)

        # -- 6. Recipients & Addresses across all 6 regions ---------------- #
        recipients_list: list[tuple[Recipient, Address, str, str]] = []
        apt_names = ["Sai Shraddha Apts", "Shree Ganesh Residency", "Shivaji Enclave", "Navkar Towers", "Surya Heights", "Prabhat Complex"]

        for idx, (name, locality, lang, pref_slot) in enumerate(RECIPIENTS):
            r = Recipient(
                name=name, phone="9812345601" if name == "Aarti Deshmukh" else _phone(),
                preferred_language=lang,
                behaviour_note=f"{pref_slot}_PERSON",
            )
            db.add(r)
            db.flush()
            lat, lng, po_code = LOCALITIES[locality]
            jlat, jlng = _jitter((lat, lng))
            city_name = offices[po_code].name.split()[0]
            apt = apt_names[idx % len(apt_names)]
            flat_no = (idx * 101) % 700 + 101
            addr = Address(
                recipient_id=r.id,
                line1=f"Flat {flat_no}, {apt}",
                line2=f"Near {locality} Main Road",
                locality=locality, pincode=offices[po_code].pincode,
                latitude=jlat, longitude=jlng, is_geocoded=True,
                city=city_name,
            )
            db.add(addr)
            db.flush()
            recipients_list.append((r, addr, po_code, pref_slot))

        # Also create dedicated recipients for inter-region transit
        inter_region_recs_by_dest: dict[str, list[tuple[Recipient, Address]]] = {}
        for idx, (name, locality, lang, po_code) in enumerate(INTER_REGION_RECIPIENTS):
            r = Recipient(
                name=name, phone=_phone(),
                preferred_language=lang,
                behaviour_note="AFTERNOON_PERSON",
            )
            db.add(r)
            db.flush()
            lat, lng, _ = LOCALITIES[locality]
            jlat, jlng = _jitter((lat, lng))
            city_name = offices[po_code].name.split()[0]
            apt = apt_names[(idx + 3) % len(apt_names)]
            flat_no = ((idx + 5) * 103) % 800 + 102
            addr = Address(
                recipient_id=r.id,
                line1=f"Flat {flat_no}, {apt}",
                line2=f"Near {locality} Landmark",
                locality=locality, pincode=offices[po_code].pincode,
                latitude=jlat, longitude=jlng, is_geocoded=True,
                city=city_name,
            )
            db.add(addr)
            db.flush()
            inter_region_recs_by_dest.setdefault(po_code, []).append((r, addr))

        counts["recipients"] = len(recipients_list) + len(INTER_REGION_RECIPIENTS)
        counts["addresses"] = len(recipients_list) + len(INTER_REGION_RECIPIENTS)

        # -- 7. Historical Delivery Training Dataset ----------------------- #
        today = _today_utc()
        hist_count = 0
        for past_day_offset in range(1, 15):
            past_day = today - timedelta(days=past_day_offset)
            for r, addr, po_code, pref_slot in recipients_list[:24]:
                sender = RNG.choice(senders)
                slot_enum = getattr(SlotCode, pref_slot)
                slot = slots[slot_enum]
                cons = Consignment(
                    tracking_number=generate_tracking_number(tracking_seq),
                    sender_id=sender.id, recipient_id=r.id, address_id=addr.id,
                    post_office_id=offices[po_code].id,
                    origin_post_office_id=offices["NSK-HO"].id,
                    priority=Priority.NORMAL,
                    description=RNG.choice(PARCEL_DESCRIPTIONS),
                    weight_grams=RNG.randint(200, 1500),
                    status=ConsignmentStatus.DELIVERED,
                    requested_slot_id=slot.id,
                    recommended_slot_id=slot.id,
                    confirmed_slot_id=slot.id,
                    delivery_date=past_day,
                )
                tracking_seq += 1
                db.add(cons)
                db.flush()

                db.add(DeliveryAttempt(
                    consignment_id=cons.id,
                    outcome=AttemptOutcome.SUCCESS,
                    notes="Delivered on time in customer preferred window",
                    attempted_at=past_day + timedelta(minutes=slot.start_minutes + 30),
                ))
                hist_count += 1
        counts["historical_consignments"] = hist_count

        # -- 8. Active Deliverable Consignments for TODAY ------------------ #
        active_count = 0
        otp_count = 0
        notif_count = 0

        # One pending slot per region to show slot booking flow
        pending_indices = {1, 9, 17, 25, 33, 41}

        # Create live deliverable parcels for EVERY post office and EVERY postman
        for idx, (r, addr, po_code, pref_slot) in enumerate(recipients_list):
            sender = RNG.choice(senders)
            slot_enum = getattr(SlotCode, pref_slot)
            slot = slots[slot_enum]
            po = offices[po_code]

            if idx in pending_indices:
                cons = Consignment(
                    tracking_number=generate_tracking_number(tracking_seq),
                    sender_id=sender.id, recipient_id=r.id, address_id=addr.id,
                    post_office_id=po.id,
                    origin_post_office_id=offices["NSK-HO"].id,
                    priority=RNG.choices([Priority.NORMAL, Priority.HIGH, Priority.URGENT], weights=[7, 2, 1])[0],
                    description=RNG.choice(PARCEL_DESCRIPTIONS),
                    weight_grams=RNG.randint(150, 2500),
                    delivery_date=today,
                    status=ConsignmentStatus.SLOT_PENDING,
                    requested_slot_id=slot.id,
                )
                tracking_seq += 1
                db.add(cons)
                db.flush()
                db.add(Notification(
                    recipient_id=r.id, consignment_id=cons.id,
                    type=NotificationType.SLOT_REQUEST, channel=NotificationChannel.IN_APP,
                    title_en="Choose your delivery time",
                    title_hi="अपना डिलीवरी समय चुनें",
                    body_en=f"Parcel {cons.tracking_number} is ready for scheduling.",
                    body_hi=f"पार्सल {cons.tracking_number} डिलीवरी हेतु तैयार है।",
                ))
                notif_count += 1
                active_count += 1
            else:
                cons = Consignment(
                    tracking_number=generate_tracking_number(tracking_seq),
                    sender_id=sender.id, recipient_id=r.id, address_id=addr.id,
                    post_office_id=po.id,
                    origin_post_office_id=offices["NSK-HO"].id,
                    priority=RNG.choices([Priority.NORMAL, Priority.HIGH, Priority.URGENT], weights=[7, 2, 1])[0],
                    description=RNG.choice(PARCEL_DESCRIPTIONS),
                    weight_grams=RNG.randint(150, 2500),
                    delivery_date=today,
                    status=ConsignmentStatus.SLOT_CONFIRMED,
                    requested_slot_id=slot.id,
                    recommended_slot_id=slot.id,
                    confirmed_slot_id=slot.id,
                )
                tracking_seq += 1
                db.add(cons)
                db.flush()

                # Record slot preference
                db.add(SlotPreference(
                    consignment_id=cons.id, slot_id=slot.id,
                    preference_type=PreferenceType.RECIPIENT_CONFIRMED, source="customer_confirmed",
                ))
                # OTP for verified delivery
                db.add(OTPVerification(
                    consignment_id=cons.id, code=generate_otp(4),
                    expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
                ))
                otp_count += 1
                active_count += 1

        # -- 9. Inter-Region Outgoing & In-Transit Batches ------------------ #
        # Outgoing from Nashik HO bound for Mumbai, Pune, Nagpur with dedicated distinct recipients
        dest_destinations = ["BOM-GPO", "BOM-AND", "PUN-HO", "NGP-GPO"]

        for dest_code in dest_destinations:
            dest_po = offices[dest_code]
            dest_recs = inter_region_recs_by_dest.get(dest_code, [])

            # 2 Booked parcels waiting to be clubbed & dispatched
            for b_i in range(2):
                rec_target = dest_recs[b_i] if len(dest_recs) > b_i else recipients_list[0][:2]
                c_booked = Consignment(
                    tracking_number=generate_tracking_number(tracking_seq),
                    sender_id=senders[0].id,
                    recipient_id=rec_target[0].id,
                    address_id=rec_target[1].id,
                    post_office_id=dest_po.id,
                    origin_post_office_id=offices["NSK-HO"].id,
                    priority=Priority.NORMAL,
                    description=f"Inter-region package to {dest_code}",
                    weight_grams=850,
                    status=ConsignmentStatus.BOOKED,
                    delivery_date=today,
                )
                tracking_seq += 1
                db.add(c_booked)
                active_count += 1

            # 2 In-Transit parcels sealed in a transit bag en route
            bag_tag = f"BAG-NSK-{dest_code.replace('-','')[:3]}-{RNG.randint(100, 999)}"
            for t_i in range(2):
                rec_target = dest_recs[t_i + 2] if len(dest_recs) > (t_i + 2) else dest_recs[0]
                c_transit = Consignment(
                    tracking_number=generate_tracking_number(tracking_seq),
                    sender_id=senders[1].id,
                    recipient_id=rec_target[0].id,
                    address_id=rec_target[1].id,
                    post_office_id=dest_po.id,
                    origin_post_office_id=offices["NSK-HO"].id,
                    priority=Priority.HIGH,
                    description=f"Sealed transit parcel to {dest_code}",
                    weight_grams=1200,
                    status=ConsignmentStatus.IN_TRANSIT,
                    bag_number=bag_tag,
                    delivery_date=today,
                )
                tracking_seq += 1
                db.add(c_transit)
                active_count += 1

        counts["active_consignments"] = active_count
        counts["otps"] = otp_count
        counts["notifications"] = notif_count

        db.commit()

    if verbose:
        print("DAKSYNC 6-Region Seed Complete:")
        for key in sorted(counts):
            print(f"  {key:>26}: {counts[key]}")
        print("\nDemo RBAC Logins:")
        print("  1. Global Admin:      admin@daksync.in / admin123 (Full multi-region access)")
        print("  2. Regional Supvs:    supervisor.nsk@daksync.in, supervisor.bom@daksync.in, etc. / super123")
        print("  3. Beat Postmen (14): postman1@daksync.in .. postman14@daksync.in / post123")
        print("  4. Customers:         sender@daksync.in, recipient@daksync.in / user123")
    return counts


if __name__ == "__main__":
    seed()
