"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useI18n, LanguageToggle } from "@/lib/i18n";
import { Field } from "@/components/Field";
import { Button } from "@/components/Button";

interface DemoCred {
  role: string;
  email: string;
  password: string;
}

const DEMO_CREDS: DemoCred[] = [
  { role: "ADMIN", email: "admin@daksync.in", password: "admin123" },
  { role: "SUPERVISOR", email: "supervisor@daksync.in", password: "super123" },
  { role: "POSTMAN", email: "postman1@daksync.in", password: "post123" },
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
        // Postmen deliver via the Flutter field app; there is no web home.
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
    <div className={lang === "hi" ? "font-hindi" : ""}>
      {/* Minimal focused header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
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

      <main className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
        <div className="animate-fade-in card p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("login.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t("login.subtitle")}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field
              label={t("login.email")}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="supervisor@daksync.in"
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

        {/* Demo credentials */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("login.demoTitle")}
          </p>
          <p className="mt-1 text-xs text-slate-400">{t("login.demoHint")}</p>
          <ul className="mt-3 space-y-1.5">
            {DEMO_CREDS.map((cred) => (
              <li key={cred.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(cred.email);
                    setPassword(cred.password);
                    setError(null);
                    setPostmanInfo(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition-colors hover:border-brand-300"
                >
                  <span>
                    <span className="font-medium text-slate-700">
                      {t(`roles.${cred.role}`)}
                    </span>
                    <span className="ml-2 text-slate-400">{cred.email}</span>
                  </span>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {cred.password}
                  </code>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
