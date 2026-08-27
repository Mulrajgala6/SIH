"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { RequireRole, useAuth } from "@/lib/auth";
import { useI18n, pickLang } from "@/lib/i18n";
import { Field, SelectField, TextareaField } from "@/components/Field";
import { Button } from "@/components/Button";
import { LocationPickerMap } from "@/components/LocationPickerMap";
import {
  createConsignment,
  listPostOffices,
  listSlots,
  type ConsignmentCreate,
  type ConsignmentOut,
  type PostOfficeOut,
  type PreferredLanguage,
  type Priority,
  type SlotCode,
  type SlotOut,
} from "@/lib/api";

const PRIORITIES: Priority[] = ["NORMAL", "HIGH", "URGENT"];

export default function NewConsignmentPage() {
  const { lang } = useI18n();
  return (
    <div className={lang === "hi" ? "font-hindi" : ""}>
      <Nav />
      <RequireRole roles={["SENDER", "SUPERVISOR", "ADMIN", "RECIPIENT"]}>
        <BookingForm />
      </RequireRole>
    </div>
  );
}

function BookingForm() {
  const { t, lang } = useI18n();
  const { token, user } = useAuth();

  const [slots, setSlots] = useState<SlotOut[]>([]);
  const [postOffices, setPostOffices] = useState<PostOfficeOut[]>([]);
  const [originPostOfficeId, setOriginPostOfficeId] = useState<number | "">("");

  const [senderName, setSenderName] = useState(user?.full_name ?? "");
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredLanguage, setPreferredLanguage] =
    useState<PreferredLanguage>("en");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("Nashik");
  const [stateName, setStateName] = useState("Maharashtra");
  const [pincode, setPincode] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [requestedSlot, setRequestedSlot] = useState<"" | SlotCode>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConsignmentOut | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listSlots()
      .then(setSlots)
      .catch(() => setSlots([]));
    listPostOffices()
      .then((pos) => {
        setPostOffices(pos);
        if (pos.length > 0) setOriginPostOfficeId(pos[0].id);
      })
      .catch(() => setPostOffices([]));
  }, []);

  const shareLink =
    result && typeof window !== "undefined"
      ? `${window.location.origin}/confirm/${result.id}`
      : "";

  const handleMapLocationSelect = (loc: {
    latitude: number;
    longitude: number;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
  }) => {
    setLatitude(loc.latitude);
    setLongitude(loc.longitude);
    if (loc.locality) setLocality(loc.locality);
    if (loc.city) setCity(loc.city);
    if (loc.state) setStateName(loc.state);
    if (loc.pincode) setPincode(loc.pincode);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    const body: ConsignmentCreate = {
      sender_id: null,
      sender_name: senderName.trim() || null,
      origin_post_office_id:
        typeof originPostOfficeId === "number" ? originPostOfficeId : null,
      recipient: {
        name: recipientName.trim(),
        phone: phone.trim(),
        preferred_language: preferredLanguage,
      },
      address: {
        line1: line1.trim(),
        line2: line2.trim() || null,
        locality: locality.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        latitude,
        longitude,
      },
      description: description.trim() || null,
      weight_grams: weight.trim() ? Number(weight) : null,
      priority,
      requested_slot_code: requestedSlot === "" ? null : requestedSlot,
    };
    try {
      const created = await createConsignment(body, token);
      setResult(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const resetForm = () => {
    setResult(null);
    setError(null);
    setSenderName("");
    setRecipientName("");
    setPhone("");
    setPreferredLanguage("en");
    setLine1("");
    setLine2("");
    setLocality("");
    setCity("Nashik");
    setStateName("Maharashtra");
    setPincode("");
    setDescription("");
    setWeight("");
    setPriority("NORMAL");
    setRequestedSlot("");
  };

  if (result) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="animate-fade-in card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl font-semibold text-ink">
                {t("consignmentNew.successTitle")}
              </h1>
              <p className="text-sm text-slate-600">
                {t("consignmentNew.successDesc")}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {t("consignmentNew.trackingNumber")}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-ink">
              {result.tracking_number}
            </p>
          </div>

          {/* Operational Workflow Card */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Operational Routing & Intake
            </h3>
            <div className="mt-2.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Drop-off Origin Counter:</span>
                <span className="font-semibold text-slate-800">{result.origin_post_office?.name ?? "Origin Hub"} ({result.origin_post_office?.code})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Destination Delivery Office:</span>
                <span className="font-semibold text-slate-800">{result.post_office?.name ?? "Destination Hub"} ({result.post_office?.code})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Intake Status:</span>
                <span className={`font-semibold ${result.status === "BOOKED" ? "text-indigo-700" : "text-emerald-700"}`}>
                  {result.status === "BOOKED"
                    ? `Queued at ${result.origin_post_office?.code} · Clustered into ${result.post_office?.code} Outbound Batch`
                    : `Direct Local Delivery · ${result.post_office?.code}`}
                </span>
              </div>
            </div>
            {result.status === "BOOKED" ? (
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 border-t border-slate-200/80 pt-2">
                This parcel is held at the <strong>{result.origin_post_office?.name}</strong> counter. It is grouped into the outbound cluster batch for <strong>{result.post_office?.name}</strong> to be sealed into an inter-hub transit bag.
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {t("consignmentNew.shareLink")}
            </p>
            <div className="mt-1 flex gap-2">
              <input
                readOnly
                value={shareLink}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-600"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button variant="secondary" onClick={copyLink}>
                {copied ? t("common.copied") : t("common.copy")}
              </Button>
            </div>
          </div>

          {/* WhatsApp Direct Share */}
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Direct WhatsApp Notification
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  Recipient phone: <strong className="font-mono">{result.recipient.phone}</strong>
                </p>
              </div>
              <a
                href={`https://wa.me/${result.recipient.phone.replace(/\D/g, "").length === 10 ? `91${result.recipient.phone.replace(/\D/g, "")}` : result.recipient.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Namaste ${result.recipient.name || "Customer"}, your India Post parcel (${result.tracking_number}) has been booked! 📦\n\nPlease select your preferred delivery time slot here:\n👉 ${shareLink}\n\nनमस्ते ${result.recipient.name || ""}, कृपया अपनी सुविधा के अनुसार डिलीवरी समय चुनें।`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1EBE5D] transition-all transform active:scale-95"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.586 1.776.883 2.796.883 3.181 0 5.767-2.586 5.767-5.766.001-3.18-2.585-5.67-5.767-5.67zm3.373 8.19c-.144.405-.837.774-1.17.824-.312.045-.634.072-1.872-.441-1.479-.613-2.482-2.115-2.557-2.215-.073-.1-1.077-1.433-1.077-2.732 0-1.299.68-1.938.922-2.202.241-.264.527-.33.703-.33.176 0 .352.002.505.01.162.008.38-.061.595.454.22.529.748 1.826.814 1.958.066.132.11.286.022.462-.088.176-.132.286-.264.44-.132.154-.277.344-.396.462-.132.132-.27.275-.116.539.154.264.685 1.13 1.47 1.83.992.884 1.829 1.159 2.093 1.291.264.132.418.11.572-.066.154-.176.66-.771.836-1.035.176-.264.352-.22.594-.132.242.088 1.54.726 1.804.858.264.132.44.198.506.308.066.11.066.639-.078 1.044z"/>
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.661 1.435 5.176L2 22l4.981-1.396A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.154c-1.637 0-3.15-.494-4.417-1.343l-.317-.213-3.275.918.924-3.19-.234-.337A8.136 8.136 0 013.846 12c0-4.496 3.658-8.154 8.154-8.154s8.154 3.658 8.154 8.154-3.658 8.154-8.154 8.154z"/>
                </svg>
                {t("consignmentNew.sendWhatsApp")}
              </a>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/confirm/${result.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("consignmentNew.openSlotPage")}
            </Link>
            <Button variant="secondary" onClick={resetForm}>
              {t("consignmentNew.createAnother")}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {t("consignmentNew.title")}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {t("consignmentNew.subtitle")}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Sender */}
        <fieldset className="card p-5">
          <legend className="section-title px-1">
            {t("consignmentNew.senderSection")}
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field
              label={t("consignmentNew.senderName")}
              required
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Sender / Company Name"
            />
            <SelectField
              label="Drop-off Post Office Counter"
              value={originPostOfficeId}
              onChange={(e) =>
                setOriginPostOfficeId(
                  e.target.value ? Number(e.target.value) : ""
                )
              }
            >
              {postOffices.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.code} · {po.name} ({po.pincode})
                </option>
              ))}
            </SelectField>
          </div>
        </fieldset>

        {/* Recipient */}
        <fieldset className="card p-5">
          <legend className="section-title px-1">
            {t("consignmentNew.recipientSection")}
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field
              label={t("consignmentNew.recipientName")}
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
            <Field
              label={t("consignmentNew.recipientPhone")}
              required
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9812345678"
            />
            <SelectField
              label={t("consignmentNew.preferredLanguage")}
              value={preferredLanguage}
              onChange={(e) =>
                setPreferredLanguage(e.target.value as PreferredLanguage)
              }
            >
              <option value="en">{t("languageName.en")}</option>
              <option value="hi">{t("languageName.hi")}</option>
            </SelectField>
          </div>
        </fieldset>

        {/* Address */}
        <fieldset className="card p-5">
          <legend className="section-title px-1">
            {t("consignmentNew.addressSection")}
          </legend>

          {/* Interactive Map Location Picker */}
          <div className="mt-3 mb-5">
            <LocationPickerMap
              latitude={latitude}
              longitude={longitude}
              locality={locality}
              onLocationSelect={handleMapLocationSelect}
            />
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label={t("consignmentNew.line1")}
                required
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="12 Gangapur Rd"
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label={t("consignmentNew.line2")}
                hint={t("common.optional")}
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
              />
            </div>
            <Field
              label={t("consignmentNew.localityLabel")}
              required
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder="Gangapur"
            />
            <Field
              label={t("consignmentNew.cityLabel")}
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Field
              label={t("consignmentNew.stateLabel")}
              required
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
            />
            <Field
              label={t("consignmentNew.pincode")}
              required
              inputMode="numeric"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="422005"
            />
          </div>
        </fieldset>

        {/* Parcel */}
        <fieldset className="card p-5">
          <legend className="section-title px-1">
            {t("consignmentNew.parcelSection")}
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextareaField
                label={t("consignmentNew.description")}
                hint={t("common.optional")}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Documents"
              />
            </div>
            <Field
              label={t("consignmentNew.weight")}
              hint={t("common.optional")}
              type="number"
              min={0}
              inputMode="numeric"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="300"
            />
            <SelectField
              label={t("consignmentNew.priority")}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`priority.${p}`)}
                </option>
              ))}
            </SelectField>
            <div className="sm:col-span-2">
              <SelectField
                label={t("consignmentNew.requestedSlot")}
                hint={t("common.optional")}
                value={requestedSlot}
                onChange={(e) =>
                  setRequestedSlot(e.target.value as "" | SlotCode)
                }
              >
                <option value="">{t("consignmentNew.noPreference")}</option>
                {slots.map((s) => (
                  <option key={s.id} value={s.code}>
                    {pickLang(lang, s.label_en, s.label_hi)}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </fieldset>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-accent">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={submitting}>
            {submitting
              ? t("consignmentNew.creating")
              : t("consignmentNew.create")}
          </Button>
        </div>
      </form>
    </main>
  );
}
