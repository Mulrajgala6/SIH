"use client";

import { Nav } from "@/components/Nav";
import { TrackExplorer } from "@/components/TrackExplorer";
import { useI18n } from "@/lib/i18n";

export default function TrackPage() {
  const { t, lang } = useI18n();
  return (
    <div className={lang === "hi" ? "font-hindi" : ""}>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("track.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t("track.subtitle")}</p>
        <div className="mt-6">
          <TrackExplorer />
        </div>
      </main>
    </div>
  );
}
