"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  recommendSlots,
  confirmSlot,
  slotWindowLabel,
  type SlotRecommendResponse,
  type SlotOut,
} from "@/lib/api";
import { useI18n, LanguageToggle, pickLang } from "@/lib/i18n";
import { SlotCard } from "@/components/SlotCard";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: SlotRecommendResponse };

export default function ConfirmSlotPage() {
  const { t, lang } = useI18n();
  const params = useParams<{ id: string }>();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const consignmentId = Number(rawId);

  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<SlotOut | null>(null);

  useEffect(() => {
    if (!Number.isFinite(consignmentId)) {
      setLoad({ kind: "error", message: t("common.error") });
      return;
    }
    let active = true;
    setLoad({ kind: "loading" });
    recommendSlots(consignmentId)
      .then((data) => {
        if (!active) return;
        setLoad({ kind: "ok", data });
        // Preselect the recommended slot if it is feasible.
        const rec = data.options.find(
          (o) => o.slot.id === data.recommended_slot_id && o.is_feasible,
        );
        if (rec) setSelectedId(rec.slot.id);
      })
      .catch((e) => {
        if (!active) return;
        setLoad({
          kind: "error",
          message: e instanceof Error ? e.message : t("common.error"),
        });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consignmentId]);

  const handleConfirm = async () => {
    if (load.kind !== "ok" || selectedId == null) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const changed = selectedId !== load.data.recommended_slot_id;
      const res = await confirmSlot({
        consignment_id: consignmentId,
        slot_id: selectedId,
        changed,
      });
      const chosen = load.data.options.find(
        (o) => o.slot.id === res.confirmed_slot_id,
      );
      setConfirmedSlot(chosen ? chosen.slot : null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const sortedOptions =
    load.kind === "ok"
      ? [...load.data.options].sort(
          (a, b) => a.slot.sort_order - b.slot.sort_order,
        )
      : [];

  return (
    <div className={`min-h-screen bg-slate-50 ${lang === "hi" ? "font-hindi" : ""}`}>
      {/* Focused header with a prominent language toggle */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              DS
            </span>
            <span className="text-base font-semibold tracking-tight text-ink">
              {t("common.appName")}
            </span>
          </Link>
          <LanguageToggle className="scale-105" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {load.kind === "loading" ? (
          <div className="flex justify-center py-20">
            <Spinner label={t("common.loading")} />
          </div>
        ) : null}

        {load.kind === "error" ? (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-8 text-center text-sm text-accent">
            {load.message}
          </div>
        ) : null}

        {load.kind === "ok" && confirmedSlot ? (
          <SuccessView slot={confirmedSlot} onChange={() => setConfirmedSlot(null)} />
        ) : null}

        {load.kind === "ok" && !confirmedSlot ? (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {t("confirm.title")}
            </h1>
            <p className="mt-2 text-slate-600">{t("confirm.subtitle")}</p>

            {sortedOptions.length === 0 ? (
              <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                {t("confirm.noOptions")}
              </div>
            ) : (
              <>
                <p className="mt-5 text-sm text-slate-500">
                  {t("confirm.selectPrompt")}
                </p>
                <div className="mt-3 grid gap-3">
                  {sortedOptions.map((option) => (
                    <SlotCard
                      key={option.slot.id}
                      option={option}
                      selected={selectedId === option.slot.id}
                      onSelect={() => {
                        setSelectedId(option.slot.id);
                        setSubmitError(null);
                      }}
                    />
                  ))}
                </div>

                {submitError ? (
                  <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-accent">
                    {submitError}
                  </p>
                ) : null}

                <div className="sticky bottom-0 mt-6 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                  <Button
                    onClick={handleConfirm}
                    loading={submitting}
                    disabled={selectedId == null}
                    size="lg"
                    fullWidth
                  >
                    {submitting ? t("confirm.confirming") : t("confirm.confirmBtn")}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );

  function SuccessView({
    slot,
    onChange,
  }: {
    slot: SlotOut;
    onChange: () => void;
  }) {
    return (
      <div className="animate-fade-in flex flex-col items-center py-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
          {t("confirm.successTitle")}
        </h1>
        <p className="mt-2 text-slate-600">{t("confirm.successMsg")}</p>

        <div className="mt-5 w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
          <p className="text-2xl font-semibold text-brand-700">
            {pickLang(lang, slot.label_en, slot.label_hi)}
          </p>
          <p className="mt-1 text-slate-500">{slotWindowLabel(slot)}</p>
        </div>

        <button
          type="button"
          onClick={onChange}
          className="mt-5 text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          {t("confirm.changeAgain")}
        </button>
      </div>
    );
  }
}
