"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useI18n, LanguageToggle } from "@/lib/i18n";
import type { Role } from "@/lib/api";

function Logo() {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
        DS
      </span>
      <span className="text-base font-semibold tracking-tight text-ink">
        {t("common.appName")}
      </span>
    </Link>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-50 text-brand-700"
          : "text-slate-600 hover:bg-slate-50 hover:text-brand-700"
      }`}
    >
      {label}
    </Link>
  );
}

export function Nav() {
  const { user, logout } = useAuth();
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const staffRoles: Role[] = ["SUPERVISOR", "ADMIN"];
  const senderRoles: Role[] = ["SENDER", "SUPERVISOR", "ADMIN"];

  const showDashboard = user ? staffRoles.includes(user.role) : false;
  const showNew = user ? (user.role === "SENDER" || staffRoles.includes(user.role)) : true;
  const showMyParcels = user ? (user.role === "SENDER" || user.role === "RECIPIENT") : false;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3.5 sm:px-8 lg:px-12">
        <Logo />

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <NavLink href="/track" label={t("nav.track")} active={isActive("/track")} />
          {showMyParcels ? (
            <NavLink
              href="/my-parcels"
              label={lang === "hi" ? "मेरे पार्सल" : "My Parcels"}
              active={isActive("/my-parcels")}
            />
          ) : null}
          {showDashboard ? (
            <NavLink
              href="/dashboard"
              label={t("nav.dashboard")}
              active={isActive("/dashboard")}
            />
          ) : null}
          {showNew ? (
            <NavLink
              href="/consignments/new"
              label={lang === "hi" ? "पार्सल बुक करें" : "Book Parcel"}
              active={pathname === "/consignments/new"}
            />
          ) : null}

          <LanguageToggle className="ml-1" />

          {user ? (
            <div className="ml-1 flex items-center gap-2">
              <span className="hidden text-right text-xs leading-tight text-slate-500 sm:block">
                <span className="block font-medium text-slate-700">
                  {user.full_name}
                </span>
                <span>{t(`roles.${user.role}`)}</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {t("nav.logout")}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="ml-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              {t("nav.login")}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
