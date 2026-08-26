"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { RequireRole, useAuth } from "@/lib/auth";
import { useI18n, pickLang } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import {
  listMySent,
  listMyReceived,
  type ConsignmentBrief,
} from "@/lib/api";

export default function MyParcelsPage() {
  const { lang } = useI18n();
  return (
    <div className={lang === "hi" ? "font-hindi" : ""}>
      <Nav />
      <RequireRole roles={["SENDER", "RECIPIENT", "SUPERVISOR", "ADMIN"]}>
        <MyParcelsContent />
      </RequireRole>
    </div>
  );
}

function MyParcelsContent() {
  const { t, lang } = useI18n();
  const { token, user } = useAuth();

  const [tab, setTab] = useState<"sent" | "received">(
    user?.role === "RECIPIENT" ? "received" : "sent"
  );
  const [sentParcels, setSentParcels] = useState<ConsignmentBrief[]>([]);
  const [receivedParcels, setReceivedParcels] = useState<ConsignmentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      listMySent(token).catch(() => []),
      listMyReceived(token).catch(() => []),
    ])
      .then(([sent, received]) => {
        setSentParcels(sent);
        setReceivedParcels(received);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("common.error"))
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const activeList = tab === "sent" ? sentParcels : receivedParcels;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {lang === "hi" ? "मेरे पार्सल और बुकिंग" : "My Parcels & Shipments"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {lang === "hi"
              ? "अपने भेजे गए और आने वाले पार्सल की स्थिति और डिलीवरी स्लॉट देखें"
              : "Track your booked shipments and incoming parcels with live updates"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/consignments/new">
            <Button variant="primary">
              <span className="mr-1.5 font-bold">+</span>
              {lang === "hi" ? "नया पार्सल बुक करें" : "Book New Parcel"}
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex border-b border-slate-200">
        <button
          onClick={() => setTab("sent")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === "sent"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>{lang === "hi" ? "भेजे गए पार्सल" : "Outbound Shipments"}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {sentParcels.length}
          </span>
        </button>
        <button
          onClick={() => setTab("received")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === "received"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>{lang === "hi" ? "आने वाले पार्सल" : "Inbound Deliveries"}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {receivedParcels.length}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : error ? (
          <div className="card p-6 text-center text-sm text-red-600">
            {error}
          </div>
        ) : activeList.length === 0 ? (
          <div className="card p-12 text-center">
            <h3 className="text-base font-semibold text-ink">
              {tab === "sent"
                ? lang === "hi"
                  ? "आपने अभी तक कोई पार्सल बुक नहीं किया है"
                  : "No outbound shipments found"
                : lang === "hi"
                ? "आपके लिए कोई आने वाला पार्सल नहीं है"
                : "No inbound deliveries found"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {tab === "sent"
                ? lang === "hi"
                  ? "नया पार्सल बुक करने के लिए ऊपर दिए बटन पर क्लिक करें।"
                  : "Book a new parcel to drop off at any Post Office counter."
                : lang === "hi"
                ? "जब कोई प्रेषक आपके नंबर पर पार्सल भेजेगा तो वह यहाँ दिखाई देगा।"
                : "Parcels sent to your registered phone number will appear here."}
            </p>
            {tab === "sent" && (
              <div className="mt-5">
                <Link href="/consignments/new">
                  <Button variant="primary">
                    {lang === "hi" ? "पार्सल बुक करें" : "Book a Parcel"}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {activeList.map((item) => (
              <ParcelCard key={item.id} item={item} isSent={tab === "sent"} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ParcelCard({
  item,
  isSent,
}: {
  item: ConsignmentBrief;
  isSent: boolean;
}) {
  const { t, lang } = useI18n();

  const getStepNumber = (status: string) => {
    switch (status) {
      case "BOOKED":
      case "RECEIVED_AT_ORIGIN":
        return 1;
      case "IN_TRANSIT":
        return 2;
      case "RECEIVED_AT_DESTINATION":
      case "SLOT_PENDING":
        return 3;
      case "SLOT_CONFIRMED":
        return 4;
      case "OUT_FOR_DELIVERY":
        return 5;
      case "DELIVERED":
        return 6;
      default:
        return 2;
    }
  };

  const currentStep = getStepNumber(item.status);

  return (
    <div className="card overflow-hidden transition hover:shadow-md">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink">
                {item.tracking_number}
              </span>
              {item.bag_number && (
                <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-xs text-indigo-700">
                  👜 {item.bag_number}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {isSent ? `To: ${item.recipient.name}` : `For: ${item.recipient.name}`}
            </p>
            <p className="text-xs text-slate-500">
              📍 {item.address.locality}, {item.address.city} · {item.address.pincode}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
          </div>
        </div>

        {/* Multi-step progress timeline */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            <div className={`p-1.5 rounded ${currentStep >= 1 ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-400"}`}>
              <span>1. {lang === "hi" ? "जमा / बुक" : "Booked"}</span>
            </div>
            <div className={`p-1.5 rounded ${currentStep >= 2 ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-400"}`}>
              <span>2. {lang === "hi" ? "ट्रांजिट बैग" : "In Transit"}</span>
            </div>
            <div className={`p-1.5 rounded ${currentStep >= 3 ? "bg-amber-50 text-amber-700 font-semibold" : "text-slate-400"}`}>
              <span>3. {lang === "hi" ? "गंतव्य केंद्र" : "Destination"}</span>
            </div>
            <div className={`p-1.5 rounded ${currentStep >= 4 ? "bg-purple-50 text-purple-700 font-semibold" : "text-slate-400"}`}>
              <span>4. {lang === "hi" ? "स्लॉट पुष्ट" : "Slot Picked"}</span>
            </div>
            <div className={`p-1.5 rounded ${currentStep >= 6 ? "bg-emerald-50 text-emerald-700 font-semibold" : currentStep >= 5 ? "bg-amber-50 text-amber-700 font-semibold" : "text-slate-400"}`}>
              <span>5. {currentStep >= 6 ? (lang === "hi" ? "वितरित" : "Delivered") : (lang === "hi" ? "डिलीवरी" : "Out")}</span>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="text-xs text-slate-500">
            {item.confirmed_slot ? (
              <span className="text-emerald-700 font-medium">
                ⏰ {item.confirmed_slot.label_en} ({item.confirmed_slot.label_hi})
              </span>
            ) : (
              <span>⏳ {lang === "hi" ? "डिलीवरी स्लॉट प्रतीक्षित" : "Slot pending selection"}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isSent && item.status !== "DELIVERED" && (
              <Link href={`/confirm/${item.id}`}>
                <Button variant="secondary" size="sm">
                  {item.confirmed_slot
                    ? lang === "hi"
                      ? "स्लॉट बदलें"
                      : "Change Slot"
                    : lang === "hi"
                    ? "स्लॉट चुनें"
                    : "Select Slot"}
                </Button>
              </Link>
            )}
            <Link href={`/track?tracking=${item.tracking_number}`}>
              <Button variant="secondary" size="sm">
                🧭 {lang === "hi" ? "ट्रैक करें" : "Track"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
