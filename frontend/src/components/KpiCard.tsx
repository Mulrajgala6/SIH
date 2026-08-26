import type { ReactNode } from "react";

export type KpiTone = "default" | "positive" | "warning" | "danger";

const TONE_VALUE: Record<KpiTone, string> = {
  default: "text-ink",
  positive: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-accent",
};

const TONE_ICON: Record<KpiTone, string> = {
  default: "bg-brand-50 text-brand-600",
  positive: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-accent",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: KpiTone;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {icon ? (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_ICON[tone]}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${TONE_VALUE[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
