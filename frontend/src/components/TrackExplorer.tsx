"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  trackConsignment,
  slotWindowLabel,
  type ConsignmentOut,
  type ConsignmentStatus,
} from "@/lib/api";
import { useI18n, pickLang } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Spinner } from "@/components/Spinner";

const MAIN_FLOW: ConsignmentStatus[] = [
  "BOOKED",
  "COLLECTED",
  "SORTED",
  "SLOT_PENDING",
  "SLOT_CONFIRMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const BRANCH_DIVERGENCE: Partial<Record<ConsignmentStatus, ConsignmentStatus>> = {
  RESCHEDULED: "SLOT_CONFIRMED",
  DELIVERY_FAILED: "OUT_FOR_DELIVERY",
  RETURNED: "OUT_FOR_DELIVERY",
};

type NodeState = "done" | "current" | "todo";
interface TimelineNode {
  status: ConsignmentStatus;
  state: NodeState;
  branch: boolean;
}

function buildTimeline(status: ConsignmentStatus): TimelineNode[] {
  const idx = MAIN_FLOW.indexOf(status);
  if (idx >= 0) {
    return MAIN_FLOW.map((s, i) => ({
      status: s,
      state: i < idx ? "done" : i === idx ? "current" : "todo",
      branch: false,
    }));
  }
  const divergence = BRANCH_DIVERGENCE[status] ?? "SORTED";
  const dIdx = MAIN_FLOW.indexOf(divergence);
  const nodes: TimelineNode[] = MAIN_FLOW.slice(0, dIdx + 1).map((s) => ({
    status: s,
    state: "done",
    branch: false,
  }));
  nodes.push({ status, state: "current", branch: true });
  return nodes;
}

type Fetch =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: ConsignmentOut }
  | { kind: "error"; message: string };

export function TrackExplorer({
  initialTracking,
}: {
  initialTracking?: string;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [input, setInput] = useState(initialTracking ?? "");
  const [state, setState] = useState<Fetch>({ kind: "idle" });

  const runFetch = useCallback(
    (tn: string) => {
      setState({ kind: "loading" });
      trackConsignment(tn)
        .then((data) => setState({ kind: "ok", data }))
        .catch((e) =>
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : t("track.notFound"),
          }),
        );
    },
    [t],
  );

  useEffect(() => {
    if (initialTracking) {
      setInput(initialTracking);
      runFetch(initialTracking);
    }
  }, [initialTracking, runFetch]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const tn = input.trim();
    if (!tn) return;
    // Navigate to the shareable deep-link; that page fetches the result.
    router.push(`/track/${encodeURIComponent(tn)}`);
    if (tn === initialTracking) runFetch(tn);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field
            label={t("track.title")}
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder={t("track.placeholder")}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button type="submit" size="lg" className="sm:mb-0">
          {t("track.trackBtn")}
        </Button>
      </form>

      <div className="mt-6">
        {state.kind === "loading" ? (
          <div className="flex justify-center py-10">
            <Spinner label={t("track.tracking")} />
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-6 text-center text-sm text-accent">
            {state.message || t("track.notFound")}
          </div>
        ) : null}

        {state.kind === "ok" ? (
          <TrackResult data={state.data} lang={lang} t={t} />
        ) : null}
      </div>
    </div>
  );
}

function TrackResult({
  data,
  lang,
  t,
}: {
  data: ConsignmentOut;
  lang: "en" | "hi";
  t: (k: string) => string;
}) {
  const timeline = buildTimeline(data.status);
  const slot = data.confirmed_slot;

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {t("track.currentStatus")}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-ink">
              {data.tracking_number}
            </p>
          </div>
          <StatusBadge status={data.status} />
        </div>
      </div>

      {/* Slot-pending CTA */}
      {data.status === "SLOT_PENDING" ? (
        <Link
          href={`/confirm/${data.id}`}
          className="block rounded-xl border border-brand-200 bg-brand-50 p-5 transition-colors hover:border-brand-400"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-brand-800">
                {t("track.chooseSlotCta")}
              </p>
              <p className="mt-0.5 text-sm text-brand-700">
                {t("track.chooseSlotDesc")}
              </p>
            </div>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-brand-700"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Timeline */}
        <div className="card p-5">
          <p className="section-title">{t("track.timeline")}</p>
          <ol className="mt-4 space-y-0">
            {timeline.map((node, i) => {
              const last = i === timeline.length - 1;
              return (
                <li key={`${node.status}-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        node.branch && node.state === "current"
                          ? "border-accent bg-accent text-white"
                          : node.state === "done"
                            ? "border-brand-600 bg-brand-600 text-white"
                            : node.state === "current"
                              ? "border-brand-600 bg-white text-brand-600"
                              : "border-slate-300 bg-white text-transparent"
                      }`}
                    >
                      {node.state === "done" ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-current" />
                      )}
                    </span>
                    {!last ? (
                      <span
                        className={`w-0.5 flex-1 ${
                          node.state === "done" ? "bg-brand-300" : "bg-slate-200"
                        }`}
                        style={{ minHeight: "1.25rem" }}
                      />
                    ) : null}
                  </div>
                  <div className={last ? "" : "pb-4"}>
                    <p
                      className={`text-sm ${
                        node.state === "current"
                          ? "font-semibold text-ink"
                          : node.state === "done"
                            ? "text-slate-600"
                            : "text-slate-400"
                      }`}
                    >
                      {t(`status.${node.status}`)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div className="card p-5">
            <p className="section-title">{t("track.confirmedSlot")}</p>
            {slot ? (
              <div className="mt-2">
                <p className="text-lg font-semibold text-ink">
                  {pickLang(lang, slot.label_en, slot.label_hi)}
                </p>
                <p className="text-sm text-slate-500">{slotWindowLabel(slot)}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">{t("common.none")}</p>
            )}
          </div>

          <div className="card p-5">
            <p className="section-title">{t("track.address")}</p>
            <address className="mt-2 not-italic text-sm leading-relaxed text-slate-700">
              <span className="block font-medium text-ink">
                {data.recipient.name}
              </span>
              {data.address.line1}
              {data.address.line2 ? <>, {data.address.line2}</> : null}
              <br />
              {data.address.locality}, {data.address.city}
              <br />
              {data.address.state} - {data.address.pincode}
            </address>
          </div>
        </div>
      </div>
    </div>
  );
}
