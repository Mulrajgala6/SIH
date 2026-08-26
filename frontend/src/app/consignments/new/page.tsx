"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { RequireRole, useAuth } from "@/lib/auth";
import { useI18n, pickLang } from "@/lib/i18n";
import { Field, SelectField, TextareaField } from "@/components/Field";
import { Button } from "@/components/Button";
import {
  createConsignment,
  listSlots,
  type ConsignmentCreate,
  type ConsignmentOut,
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
      <RequireRole roles={["SENDER", "SUPERVISOR", "ADMIN"]}>
        <BookingForm />
      </RequireRole>
    </div>
  );
}

function BookingForm() {
  const { t, lang } = useI18n();
  const { token } = useAuth();

  const [slots, setSlots] = useState<SlotOut[]>([]);

  const [senderName, setSenderName] = useState("");
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
  }, []);

  const shareLink =
    result && typeof window !== "undefined"
      ? `${window.location.origin}/confirm/${result.id}`
      : "";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    const body: ConsignmentCreate = {
      sender_id: null,
      sender_name: senderName.trim() || null,
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
        latitude: null,
        longitude: null,
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
          <div className="mt-3">
            <Field
              label={t("consignmentNew.senderName")}
              required
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Amazon Fulfilment"
            />
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
