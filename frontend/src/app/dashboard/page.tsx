"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { RequireRole, useAuth } from "@/lib/auth";
import { useI18n, pickLang, type Lang } from "@/lib/i18n";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { CONTROL_CLASS } from "@/components/Field";
import { RouteMap } from "@/components/RouteMap";
import {
  getDashboard,
  listConsignments,
  listRoutes,
  optimizeRoutes,
  minutesToLabel,
  slotWindowLabel,
  type ConsignmentBrief,
  type ConsignmentStatus,
  type DashboardOut,
  type RouteOut,
} from "@/lib/api";

const STATUS_OPTIONS: ConsignmentStatus[] = [
  "BOOKED",
  "COLLECTED",
  "SORTED",
  "SLOT_PENDING",
  "SLOT_CONFIRMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RESCHEDULED",
  "RETURNED",
];

export default function DashboardPage() {
  const { lang } = useI18n();
  return (
    <div className={lang === "hi" ? "font-hindi" : ""}>
      <Nav />
      <RequireRole roles={["SUPERVISOR", "ADMIN"]}>
        <DashboardView />
      </RequireRole>
    </div>
  );
}

function DashboardView() {
  const { t, lang } = useI18n();
  const { token } = useAuth();

  const [dashboard, setDashboard] = useState<DashboardOut | null>(null);
  const [consignments, setConsignments] = useState<ConsignmentBrief[]>([]);
  const [routes, setRoutes] = useState<RouteOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"" | ConsignmentStatus>("");
  const [q, setQ] = useState("");
  const [listLoading, setListLoading] = useState(false);

  const [optimizing, setOptimizing] = useState(false);
  const [optimizeMsg, setOptimizeMsg] = useState<string | null>(null);
  const [unassigned, setUnassigned] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [routeViewMode, setRouteViewMode] = useState<"MAP" | "LIST">("MAP");
  const [selectedMapRouteId, setSelectedMapRouteId] = useState<number | null>(null);

  const reloadConsignments = useCallback(
    async (statusArg: "" | ConsignmentStatus, qArg: string) => {
      if (!token) return;
      setListLoading(true);
      try {
        const data = await listConsignments(
          {
            status: statusArg === "" ? undefined : statusArg,
            q: qArg.trim() || undefined,
          },
          token,
        );
        setConsignments(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("common.error"));
      } finally {
        setListLoading(false);
      }
    },
    [token, t],
  );

  const reloadDashboard = useCallback(async () => {
    if (!token) return;
    const data = await getDashboard(token);
    setDashboard(data);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    Promise.all([
      getDashboard(token),
      listConsignments({}, token),
      listRoutes({}, token),
    ])
      .then(([d, c, r]) => {
        if (!active) return;
        setDashboard(d);
        setConsignments(c);
        setRoutes(r);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : t("common.error"));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token, t]);

  const runOptimize = async () => {
    if (!token) return;
    setOptimizing(true);
    setOptimizeMsg(null);
    try {
      const res = await optimizeRoutes({}, token);
      setRoutes(res.routes);
      setUnassigned(res.unassigned_consignment_ids);
      setOptimizeMsg(t("dashboard.routesGenerated"));
      await Promise.all([reloadDashboard(), reloadConsignments(status, q)]);
    } catch (e) {
      setOptimizeMsg(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-accent">{error}</p>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={() => window.location.reload()}
        >
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("dashboard.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t("dashboard.subtitle")}</p>
        </div>
        <Button onClick={runOptimize} loading={optimizing}>
          {optimizing ? t("dashboard.optimizing") : t("dashboard.optimizeRoutes")}
        </Button>
      </div>

      {optimizeMsg ? (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {optimizeMsg}
        </p>
      ) : null}

      {/* KPIs */}
      {dashboard ? (
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label={t("dashboard.kpiTotalActive")} value={dashboard.total_active} />
          <KpiCard
            label={t("dashboard.kpiDeliveredToday")}
            value={dashboard.delivered_today}
            tone="positive"
          />
          <KpiCard
            label={t("dashboard.kpiOutForDelivery")}
            value={dashboard.out_for_delivery}
          />
          <KpiCard
            label={t("dashboard.kpiPendingSlot")}
            value={dashboard.pending_slot}
            tone="warning"
          />
          <KpiCard
            label={t("dashboard.kpiFailedToday")}
            value={dashboard.failed_today}
            tone="danger"
          />
          <KpiCard
            label={t("dashboard.kpiFirstAttempt")}
            value={`${dashboard.first_attempt_success_rate}%`}
            tone="positive"
          />
          <KpiCard
            label={t("dashboard.kpiRoutesPlanned")}
            value={dashboard.routes_planned}
          />
          <KpiCard
            label={t("dashboard.kpiTotalDistance")}
            value={`${dashboard.total_route_distance_km.toFixed(1)} km`}
          />
        </section>
      ) : null}

      {/* Distribution + breakdown */}
      {dashboard ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <p className="section-title">{t("dashboard.slotDistribution")}</p>
            <SlotBars dashboard={dashboard} lang={lang} emptyLabel={t("dashboard.slotDistributionEmpty")} />
          </div>
          <div className="card p-5">
            <p className="section-title">{t("dashboard.statusBreakdown")}</p>
            {dashboard.status_breakdown.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">
                {t("dashboard.statusBreakdownEmpty")}
              </p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {dashboard.status_breakdown.map((item) => (
                  <li
                    key={item.status}
                    className="inline-flex items-center gap-1.5"
                  >
                    <StatusBadge status={item.status} />
                    <span className="text-sm font-semibold text-slate-700">
                      {item.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {/* Consignments */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">
            {t("dashboard.consignments")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => {
                const v = e.target.value as "" | ConsignmentStatus;
                setStatus(v);
                reloadConsignments(v, q);
              }}
              className={`${CONTROL_CLASS} w-auto`}
              aria-label={t("dashboard.statusFilter")}
            >
              <option value="">{t("common.all")}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                reloadConsignments(status, q);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("dashboard.searchPlaceholder")}
                className={`${CONTROL_CLASS} w-56`}
                aria-label={t("common.search")}
              />
              <Button type="submit" variant="secondary">
                {t("common.search")}
              </Button>
            </form>
          </div>
        </div>

        <div className="card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("dashboard.colTracking")}</th>
                  <th className="px-4 py-3 font-medium">{t("dashboard.colRecipient")}</th>
                  <th className="px-4 py-3 font-medium">{t("dashboard.colLocality")}</th>
                  <th className="px-4 py-3 font-medium">{t("dashboard.colStatus")}</th>
                  <th className="px-4 py-3 font-medium">{t("dashboard.colSlot")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <Spinner label={t("common.loading")} />
                    </td>
                  </tr>
                ) : consignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      {t("dashboard.noConsignments")}
                    </td>
                  </tr>
                ) : (
                  consignments.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {c.tracking_number}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {c.recipient.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.address.locality}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.confirmed_slot
                          ? pickLang(
                              lang,
                              c.confirmed_slot.label_en,
                              c.confirmed_slot.label_hi,
                            )
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/consignments/${c.id}`}
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          {t("dashboard.viewDetail")}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Routes Section */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{t("dashboard.routes")}</h2>
            <p className="text-xs text-slate-500">
              {routes.length} {t("dashboard.routes").toLowerCase()} planned today
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setRouteViewMode("MAP")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                routeViewMode === "MAP"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-brand-700"
              }`}
            >
              <span>🗺️</span> {t("map.viewModeMap")}
            </button>
            <button
              type="button"
              onClick={() => setRouteViewMode("LIST")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                routeViewMode === "LIST"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-brand-700"
              }`}
            >
              <span>📋</span> {t("map.viewModeList")}
            </button>
          </div>
        </div>

        {unassigned.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">{t("dashboard.unassignedTitle")}</p>
            <p className="mt-0.5">
              {t("dashboard.unassignedDesc")} {unassigned.join(", ")}
            </p>
          </div>
        ) : null}

        {routes.length === 0 ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            {t("dashboard.noRoutes")}
          </p>
        ) : routeViewMode === "MAP" ? (
          <div className="mt-4">
            <RouteMap
              routes={routes}
              unassignedConsignments={consignments.filter((c) =>
                unassigned.includes(c.id),
              )}
              selectedRouteId={selectedMapRouteId}
              onSelectRoute={setSelectedMapRouteId}
            />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {routes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                expanded={expanded === route.id}
                onToggle={() =>
                  setExpanded(expanded === route.id ? null : route.id)
                }
                onViewOnMap={() => {
                  setSelectedMapRouteId(route.id);
                  setRouteViewMode("MAP");
                }}
                lang={lang}
                t={t}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SlotBars({
  dashboard,
  lang,
  emptyLabel,
}: {
  dashboard: DashboardOut;
  lang: Lang;
  emptyLabel: string;
}) {
  const items = dashboard.slot_distribution;
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-slate-400">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li key={item.slot_code}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">
              {pickLang(lang, item.label_en, item.label_hi)}
            </span>
            <span className="font-semibold text-slate-700">{item.count}</span>
          </div>
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RouteCard({
  route,
  expanded,
  onToggle,
  onViewOnMap,
  lang,
  t,
}: {
  route: RouteOut;
  expanded: boolean;
  onToggle: () => void;
  onViewOnMap: () => void;
  lang: Lang;
  t: (k: string) => string;
}) {
  const km =
    route.total_distance_m != null
      ? (route.total_distance_m / 1000).toFixed(1)
      : "—";
  return (
    <div className="card overflow-hidden">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/60">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="10" r="3" />
              <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z" />
            </svg>
          </span>
          <div>
            <p className="font-medium text-ink">
              {route.agent ? route.agent.name : t("dashboard.unnamedAgent")}
            </p>
            <p className="text-xs text-slate-500">
              {t("dashboard.optimizer")}: {route.optimizer ?? "—"}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-400">{t("dashboard.stops")}</p>
            <p className="text-sm font-semibold text-slate-700">
              {route.total_stops}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{t("dashboard.distance")}</p>
            <p className="text-sm font-semibold text-slate-700">{km} km</p>
          </div>
          <StatusBadge status={route.status} kind="route" />

          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onViewOnMap();
            }}
          >
            <span>🗺️</span> {t("map.viewOnMap")}
          </Button>

          <button
            type="button"
            onClick={onToggle}
            className="p-1 text-slate-400 hover:text-slate-600"
            aria-label="Expand route stops"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {expanded ? (
        <ol className="border-t border-slate-100 px-5 py-4">
          {route.stops.length === 0 ? (
            <li className="text-sm text-slate-400">{t("dashboard.noConsignments")}</li>
          ) : (
            route.stops.map((stop) => {
              const c = stop.consignment;
              const slot = c.confirmed_slot;
              const hasCoords =
                c.address.latitude != null && c.address.longitude != null;
              const navUrl = hasCoords
                ? `https://www.google.com/maps/dir/?api=1&destination=${c.address.latitude},${c.address.longitude}`
                : undefined;

              return (
                <li
                  key={stop.id}
                  className="flex items-start gap-3 border-b border-slate-50 py-2.5 last:border-b-0"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {stop.sequence}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{c.recipient.name}</span>
                      <StatusBadge status={stop.status} kind="stop" />
                      {navUrl && (
                        <a
                          href={navUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-50"
                        >
                          🧭 GPS
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {c.address.locality}
                      {slot ? (
                        <>
                          {" · "}
                          {pickLang(lang, slot.label_en, slot.label_hi)} (
                          {slotWindowLabel(slot)})
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-400">{t("dashboard.eta")}</p>
                    <p className="text-sm font-medium text-slate-700">
                      {stop.eta_minutes != null
                        ? minutesToLabel(stop.eta_minutes)
                        : "—"}
                    </p>
                  </div>
                </li>
              );
            })
          )}
        </ol>
      ) : null}
    </div>
  );
}
