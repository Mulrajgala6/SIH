"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { API_URL, getHealth, type HealthResponse } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Nav } from "@/components/Nav";

type State =
  | { kind: "checking" }
  | { kind: "ok"; data: HealthResponse }
  | { kind: "error"; message: string };

const PIPELINE_KEYS = [
  "pipeline.step1",
  "pipeline.step2",
  "pipeline.step3",
  "pipeline.step4",
  "pipeline.step5",
  "pipeline.step6",
  "pipeline.step7",
];

export default function Home() {
  const { t, lang } = useI18n();
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    let active = true;
    getHealth()
      .then((data) => active && setState({ kind: "ok", data }))
      .catch((e) => active && setState({ kind: "error", message: String(e) }));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={lang === "hi" ? "font-hindi" : ""}>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {/* Hero */}
        <section className="animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {t("common.tagline")}
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            {t("landing.heroSubtitle")}
          </p>
        </section>

        {/* Role entry cards */}
        <section className="mt-10">
          <h2 className="section-title">{t("landing.entryTitle")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <EntryCard
              href="/login"
              title={t("landing.supervisorCard")}
              desc={t("landing.supervisorCardDesc")}
              cta={t("landing.open")}
              icon={
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
              }
            />
            <EntryCard
              href="/login"
              title={t("landing.senderCard")}
              desc={t("landing.senderCardDesc")}
              cta={t("landing.open")}
              icon={
                <>
                  <path d="M16 16h6M19 13v6" />
                  <path d="M21 10V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0" />
                  <path d="m7.5 4.3 8.5 4.9M3.3 7 12 12l8.7-5" />
                </>
              }
            />
            <EntryCard
              href="/track"
              title={t("landing.trackCard")}
              desc={t("landing.trackCardDesc")}
              cta={t("landing.open")}
              icon={
                <>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </>
              }
            />
          </div>
        </section>

        {/* Pipeline */}
        <section className="mt-12">
          <h2 className="section-title">{t("landing.journeyTitle")}</h2>
          <ol className="mt-4 flex flex-wrap gap-2">
            {PIPELINE_KEYS.map((key, i) => (
              <li
                key={key}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                {t(key)}
              </li>
            ))}
          </ol>
        </section>

        {/* Backend connectivity */}
        <section className="mt-12 max-w-xl">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                {t("landing.backendConnection")}
              </span>
              <StatusPill state={state} />
            </div>
            <p className="mt-2 break-all text-xs text-slate-500">{API_URL}</p>
            {state.kind === "ok" && (
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Meta label={t("landing.service")} value={state.data.service} />
                <Meta label={t("landing.version")} value={state.data.version} />
                <Meta
                  label={t("landing.database")}
                  value={`${state.data.database.engine} · ${
                    state.data.database.connected
                      ? t("landing.connected")
                      : t("landing.notReachable")
                  }`}
                />
                <Meta label={t("landing.status")} value={state.data.status} />
              </dl>
            )}
            {state.kind === "error" && (
              <p className="mt-3 text-sm text-accent">{t("landing.backendHelp")}</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );

  function StatusPill({ state }: { state: State }) {
    const map = {
      checking: { text: t("landing.checking"), cls: "bg-slate-100 text-slate-600" },
      ok: { text: t("landing.connected"), cls: "bg-emerald-50 text-emerald-700" },
      error: { text: t("landing.notReachable"), cls: "bg-red-50 text-accent" },
    } as const;
    const s = map[state.kind];
    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
        {s.text}
      </span>
    );
  }
}

function EntryCard({
  href,
  title,
  desc,
  cta,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  cta: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </span>
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-600">{desc}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
        {cta}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  );
}
