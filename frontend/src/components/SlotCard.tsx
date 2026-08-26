"use client";

import { useI18n, pickLang } from "@/lib/i18n";
import { slotWindowLabel, type SlotOption } from "@/lib/api";

/**
 * Large, tappable delivery-slot card for the recipient confirmation page.
 *
 * Shows the bilingual slot label + time window. The recommended option is
 * highlighted with a badge and a friendly reason string. Non-feasible options
 * render disabled. It NEVER shows a numeric score/probability (none is sent).
 */
export function SlotCard({
  option,
  selected,
  onSelect,
}: {
  option: SlotOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const { lang, t } = useI18n();
  const { slot, is_recommended, is_feasible, reason_en, reason_hi } = option;

  const label = pickLang(lang, slot.label_en, slot.label_hi);
  const reason = pickLang(lang, reason_en, reason_hi);
  const hindi = lang === "hi";

  const base =
    "relative w-full rounded-2xl border p-5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-300";

  const stateClass = !is_feasible
    ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
    : selected
      ? "border-brand-600 bg-brand-50 ring-2 ring-brand-200 shadow-sm"
      : is_recommended
        ? "border-brand-300 bg-white hover:border-brand-400 hover:shadow-sm"
        : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!is_feasible}
      aria-pressed={selected}
      className={`${base} ${stateClass}`}
    >
      {is_recommended && is_feasible ? (
        <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.6 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6L12 2z" />
          </svg>
          <span className={hindi ? "font-hindi" : ""}>{t("confirm.recommended")}</span>
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-xl font-semibold text-ink ${hindi ? "font-hindi" : ""}`}
          >
            {label}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {slotWindowLabel(slot)}
          </p>
        </div>

        <span
          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            selected
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-slate-300 bg-white text-transparent"
          }`}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      </div>

      {is_recommended && is_feasible && reason ? (
        <p className={`mt-3 text-sm text-brand-700 ${hindi ? "font-hindi" : ""}`}>
          {reason}
        </p>
      ) : null}

      {!is_feasible ? (
        <p className={`mt-3 text-xs font-medium text-slate-400 ${hindi ? "font-hindi" : ""}`}>
          {t("confirm.notAvailableNote")}
        </p>
      ) : null}
    </button>
  );
}
