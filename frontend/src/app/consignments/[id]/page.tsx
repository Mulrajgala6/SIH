"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { RequireRole, useAuth } from "@/lib/auth";
import { useI18n, pickLang } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { SelectField } from "@/components/Field";
import { ConsignmentMap } from "@/components/ConsignmentMap";
import {
  getConsignment,
  updateConsignment,
  slotWindowLabel,
  type ConsignmentOut,
  type ConsignmentStatus,
  type Priority,
  type SlotOut,
} from "@/lib/api";

const STATUS_OPTIONS: ConsignmentStatus[] = [
  "BOOKED",
  "COLLECTED",
  "SORTED",
  "SLOT_PENDING",
  "SLOT_CONFIRMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RESCHEDULED",
  "RETURNED",
];

const PRIORITIES: Priority[] = ["NORMAL", "HIGH", "URGENT"];

export default function ConsignmentDetailPage() {
  const { lang } = useI18n();
  return (
    <div className={lang === "hi" ? "font-hindi" : ""}>
      <Nav />
      <RequireRole roles={["SUPERVISOR", "ADMIN"]}>
        <Detail />
      </RequireRole>
    </div>
  );
}

function Detail() {
  const { t, lang } = useI18n();
  const { token } = useAuth();
  const params = useParams<{ id: string }>();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = Number(rawId);

  const [consignment, setConsignment] = useState<ConsignmentOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusSel, setStatusSel] = useState<ConsignmentStatus>("SLOT_PENDING");
  const [prioritySel, setPrioritySel] = useState<Priority>("NORMAL");
  const [applying, setApplying] = useState(false);
  const [patchMsg, setPatchMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(id)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getConsignment(id, token);
      setConsignment(data);
      setStatusSel(data.status);
      setPrioritySel(data.priority);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [token, id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const applyChanges = async () => {
    if (!token) return;
    setApplying(true);
    setPatchMsg(null);
    try {
      const updated = await updateConsignment(
        id,
        { status: statusSel, priority: prioritySel },
        token,
      );
      setConsignment(updated);
      setStatusSel(updated.status);
      setPrioritySel(updated.priority);
      setPatchMsg(t("detail.updated"));
    } catch (e) {
      setPatchMsg(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  if (error || !consignment) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-accent">{error ?? t("common.error")}</p>
        <Button className="mt-4" variant="secondary" onClick={load}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const c = consignment;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        {t("nav.dashboard")}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-ink">
            {c.tracking_number}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("detail.title")}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={c.status} />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {t(`priority.${c.priority}`)}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* Left column: details */}
        <div className="space-y-5 lg:col-span-2">
          <div className="card p-5">
            <p className="section-title">{t("detail.parcel")}</p>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <Info label={t("consignmentNew.description")} value={c.description ?? t("detail.notSet")} />
              <Info
                label={t("detail.weight")}
                value={
                  c.weight_grams != null
                    ? `${c.weight_grams} ${t("detail.grams")}`
                    : t("detail.notSet")
                }
              />
              <Info label={t("consignmentNew.priority")} value={t(`priority.${c.priority}`)} />
              <Info
                label={t("detail.postOffice")}
                value={c.post_office_id != null ? `#${c.post_office_id}` : t("detail.notSet")}
              />
              <Info
                label={t("detail.createdAt")}
                value={new Date(c.created_at).toLocaleString()}
              />
            </dl>
          </div>

          <div className="card p-5">
            <p className="section-title">{t("detail.slotHistory")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <SlotChip label={t("detail.requestedSlot")} slot={c.requested_slot} lang={lang} notSet={t("detail.notSet")} />
              <SlotChip label={t("detail.recommendedSlot")} slot={c.recommended_slot} lang={lang} notSet={t("detail.notSet")} />
              <SlotChip
                label={t("detail.confirmedSlot")}
                slot={c.confirmed_slot}
                lang={lang}
                notSet={t("detail.notSet")}
                highlight
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="card p-5">
              <p className="section-title">{t("detail.sender")}</p>
              <p className="mt-2 text-sm font-medium text-ink">
                {c.sender ? c.sender.name : t("detail.notSet")}
              </p>
              {c.sender?.organization ? (
                <p className="text-sm text-slate-500">{c.sender.organization}</p>
              ) : null}
            </div>
            <div className="card p-5">
              <p className="section-title">{t("detail.recipient")}</p>
              <p className="mt-2 text-sm font-medium text-ink">{c.recipient.name}</p>
              <p className="text-sm text-slate-500">{c.recipient.phone}</p>
              <p className="text-xs text-slate-400">
                {t("consignmentNew.preferredLanguage")}:{" "}
                {t(`languageName.${c.recipient.preferred_language}`)}
              </p>
            </div>
          </div>

          <div className="card p-5">
            <p className="section-title">{t("detail.address")}</p>
            <address className="mt-2 not-italic text-sm leading-relaxed text-slate-700">
              {c.address.line1}
              {c.address.line2 ? <>, {c.address.line2}</> : null}
              <br />
              {c.address.locality}, {c.address.city}
              <br />
              {c.address.state} - {c.address.pincode}
            </address>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${
                  c.address.is_geocoded
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {c.address.is_geocoded ? t("detail.geocoded") : t("detail.notGeocoded")}
              </span>
              {c.address.latitude != null && c.address.longitude != null ? (
                <span className="text-slate-400">
                  {t("detail.coordinates")}: {c.address.latitude.toFixed(4)},{" "}
                  {c.address.longitude.toFixed(4)}
                </span>
              ) : null}
            </div>
          </div>

          {/* Interactive Parcel Map Location */}
          <ConsignmentMap
            address={c.address}
            recipientName={c.recipient.name}
            trackingNumber={c.tracking_number}
          />
        </div>

        {/* Right column: quick actions */}
        <div className="lg:col-span-1">
          <div className="card sticky top-20 p-5">
            <p className="section-title">{t("detail.quickActions")}</p>
            <div className="mt-3 space-y-3">
              <SelectField
                label={t("detail.updateStatus")}
                value={statusSel}
                onChange={(e) => setStatusSel(e.target.value as ConsignmentStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={t("detail.updatePriority")}
                value={prioritySel}
                onChange={(e) => setPrioritySel(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`priority.${p}`)}
                  </option>
                ))}
              </SelectField>
              <Button onClick={applyChanges} loading={applying} fullWidth>
                {applying ? t("detail.applying") : t("detail.apply")}
              </Button>
              {patchMsg ? (
                <p className="text-center text-sm text-slate-600">{patchMsg}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{value}</dd>
    </div>
  );
}

function SlotChip({
  label,
  slot,
  lang,
  notSet,
  highlight,
}: {
  label: string;
  slot: SlotOut | null;
  lang: "en" | "hi";
  notSet: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight && slot
          ? "border-brand-200 bg-brand-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      {slot ? (
        <>
          <p className="mt-1 text-sm font-semibold text-ink">
            {pickLang(lang, slot.label_en, slot.label_hi)}
          </p>
          <p className="text-xs text-slate-500">{slotWindowLabel(slot)}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-400">{notSet}</p>
      )}
    </div>
  );
}
