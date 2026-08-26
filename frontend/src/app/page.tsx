"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Nav } from "@/components/Nav";

export default function Home() {
  const { t, lang } = useI18n();

  return (
    <div className={`min-h-screen bg-slate-50/50 ${lang === "hi" ? "font-hindi" : ""}`}>
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8 sm:py-20 lg:px-12">
        {/* Hero Section */}
        <section className="animate-fade-in">
          <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            {t("landing.heroTitle")}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-xl sm:leading-relaxed">
            {t("landing.heroSubtitle")}
          </p>
        </section>

        {/* Role Entry Cards */}
        <section className="mt-12 sm:mt-16">
          <div className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 sm:text-sm">
              {t("landing.entryTitle")}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
      </main>
    </div>
  );
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
      className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg sm:p-8"
    >
      <div>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
          <svg
            width="24"
            height="24"
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
        <h3 className="mt-5 text-lg font-bold text-slate-900 transition-colors group-hover:text-brand-700 sm:text-xl">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
          {desc}
        </p>
      </div>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
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
          className="transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
