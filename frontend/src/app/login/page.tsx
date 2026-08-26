"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useI18n, LanguageToggle } from "@/lib/i18n";
import { Field } from "@/components/Field";
import { Button } from "@/components/Button";

interface SampleAccount {
  role: string;
  label?: string;
  email: string;
  password: string;
}

const SAMPLE_ACCOUNTS: SampleAccount[] = [
  { role: "ADMIN", label: "Global Administrator", email: "admin@daksync.in", password: "admin123" },
  { role: "SUPERVISOR", label: "Nashik HO Supervisor", email: "supervisor.nsk@daksync.in", password: "super123" },
  { role: "SUPERVISOR", label: "Mumbai GPO Supervisor", email: "supervisor.bom@daksync.in", password: "super123" },
  { role: "SUPERVISOR", label: "Pune HO Supervisor", email: "supervisor.pun@daksync.in", password: "super123" },
  { role: "POSTMAN", label: "Beat Postman", email: "postman1@daksync.in", password: "post123" },
  { role: "SENDER", label: "Sender / Shipper", email: "sender@daksync.in", password: "user123" },
  { role: "RECIPIENT", label: "Recipient / Consignee", email: "recipient@daksync.in", password: "user123" },
];

export default function LoginPage() {
  const { t, lang } = useI18n();
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postmanInfo, setPostmanInfo] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPostmanInfo(false);
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "SUPERVISOR" || user.role === "ADMIN") {
        router.push("/dashboard");
      } else if (user.role === "SENDER") {
        router.push("/consignments/new");
      } else if (user.role === "POSTMAN") {
        setPostmanInfo(true);
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.invalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50/50 ${lang === "hi" ? "font-hindi" : ""}`}>
      {/* Minimal focused header */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              DS
            </span>
            <span className="text-base font-semibold tracking-tight text-ink">
              {t("common.appName")}
            </span>
          </Link>
          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6 sm:py-16">
        <div className="animate-fade-in card p-6 sm:p-8 shadow-xs border border-slate-200/80">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {t("login.title")}
          </h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field
              label={t("login.email")}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@daksync.in"
            />
            <Field
              label={t("login.password")}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-accent">
                {error}
              </p>
            ) : null}

            {postmanInfo ? (
              <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-3 text-sm text-brand-800">
                <p>{t("login.postmanNote")}</p>
                <div className="mt-2 flex gap-3">
                  <Link href="/" className="font-medium text-brand-700 underline">
                    {t("guard.goHome")}
                  </Link>
                  <Link
                    href="/track"
                    className="font-medium text-brand-700 underline"
                  >
                    {t("nav.track")}
                  </Link>
                </div>
              </div>
            ) : null}

            <Button type="submit" loading={loading} fullWidth>
              {loading ? t("login.signingIn") : t("login.signIn")}
            </Button>
          </form>
        </div>

        {/* Quick Access Accounts */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {t("login.demoTitle")}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{t("login.demoHint")}</p>
          <ul className="mt-3 space-y-1.5">
            {SAMPLE_ACCOUNTS.map((cred) => (
              <li key={cred.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(cred.email);
                    setPassword(cred.password);
                    setError(null);
                    setPostmanInfo(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-left text-sm transition-colors hover:border-brand-300 hover:bg-white"
                >
                  <span className="truncate">
                    <span className="font-semibold text-slate-800">
                      {cred.label ?? t(`roles.${cred.role}`)}
                    </span>
                    <span className="ml-2 text-xs text-slate-400 font-mono">{cred.email}</span>
                  </span>
                  <span className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[11px] font-mono text-slate-600 shrink-0">
                    {cred.password}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
