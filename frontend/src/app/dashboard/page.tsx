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
  listPostOffices,
  listOutgoingGroups,
  listIncomingBags,
  dispatchBag,
  receiveBag,
  optimizeRoutes,
  minutesToLabel,
  slotWindowLabel,
  type ConsignmentBrief,
  type ConsignmentStatus,
  type DashboardOut,
  type RouteOut,
  type PostOfficeOut,
  type OutgoingGroup,
  type IncomingBagGroup,
} from "@/lib/api";

const STATUS_OPTIONS: ConsignmentStatus[] = [
  "BOOKED",
  "RECEIVED_AT_ORIGIN",
  "COLLECTED",
  "SORTED",
  "IN_TRANSIT",
  "RECEIVED_AT_DESTINATION",
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
  const { token, user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [postOffices, setPostOffices] = useState<PostOfficeOut[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(
    user?.post_office_id ?? null
  );

  const [dashboard, setDashboard] = useState<DashboardOut | null>(null);
  const [consignments, setConsignments] = useState<ConsignmentBrief[]>([]);
  const [routes, setRoutes] = useState<RouteOut[]>([]);
  const [outgoingGroups, setOutgoingGroups] = useState<OutgoingGroup[]>([]);
  const [incomingBags, setIncomingBags] = useState<IncomingBagGroup[]>([]);

  const [activeTab, setActiveTab] = useState<"ROUTES" | "TRANSIT" | "CONSIGNMENTS">("ROUTES");
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

  const [dispatching, setDispatching] = useState<number | null>(null);
  const [receivingBagNo, setReceivingBagNo] = useState<string | null>(null);
  const [receiveInputNo, setReceiveInputNo] = useState("");
  const [transitMsg, setTransitMsg] = useState<string | null>(null);

  const currentPo = postOffices.find((p) => p.id === selectedPoId);

  // Load initial post offices and initialize role-based office
  useEffect(() => {
    listPostOffices()
      .then((pos) => {
        setPostOffices(pos);
        if (user?.role === "SUPERVISOR" && user?.post_office_id) {
          setSelectedPoId(user.post_office_id);
        } else if (!selectedPoId && pos.length > 0) {
          setSelectedPoId(pos[0].id);
        }
      })
      .catch(() => setPostOffices([]));
  }, [user]);

  const reloadConsignments = useCallback(
    async (poId: number | null, statusArg: "" | ConsignmentStatus, qArg: string) => {
      if (!token) return;
      setListLoading(true);
      try {
        const data = await listConsignments(
          {
            post_office_id: poId ?? undefined,
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

  const reloadDashboard = useCallback(async (poId?: number | null) => {
    if (!token) return;
    const data = await getDashboard(token, poId);
    setDashboard(data);
  }, [token]);

  const reloadRoutes = useCallback(async (poId?: number) => {
    if (!token) return;
    const r = await listRoutes({ post_office_id: poId }, token);
    setRoutes(r);
  }, [token]);

  const reloadTransit = useCallback(async (poId: number) => {
    if (!token) return;
    try {
      const [groups, incoming] = await Promise.all([
        listOutgoingGroups(poId, token).catch(() => []),
        listIncomingBags(poId, token).catch(() => []),
      ]);
      setOutgoingGroups(groups);
      setIncomingBags(incoming);
    } catch {
      setOutgoingGroups([]);
      setIncomingBags([]);
    }
  }, [token]);

  useEffect(() => {
    if (!token || selectedPoId === null) return;
    setLoading(true);
    setError(null);

    Promise.all([
      reloadDashboard(selectedPoId),
      reloadRoutes(selectedPoId),
      reloadConsignments(selectedPoId, status, q),
      reloadTransit(selectedPoId),
    ])
      .catch((e) => setError(e instanceof Error ? e.message : t("common.error")))
      .finally(() => setLoading(false));
  }, [token, selectedPoId, reloadDashboard, reloadRoutes, reloadConsignments, reloadTransit, status, q]);

  const handleOptimize = async () => {
    if (!token || !currentPo) return;
    setOptimizing(true);
    setOptimizeMsg(null);
    try {
      const res = await optimizeRoutes({ post_office_code: currentPo.code }, token);
      setOptimizeMsg(
        lang === "hi"
          ? `${currentPo.name} हेतु ${res.routes.length} डिलीवरी रूट सफलतापूर्वक अनुकूलित किए गए!`
          : `Successfully optimized ${res.routes.length} delivery routes for ${currentPo.name}!`,
      );
      setUnassigned(res.unassigned_consignment_ids);
      await Promise.all([
        reloadRoutes(currentPo.id),
        reloadDashboard(currentPo.id),
        reloadConsignments(currentPo.id, status, q),
      ]);
    } catch (e) {
      setOptimizeMsg(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setOptimizing(false);
    }
  };

  const handleDispatch = async (group: OutgoingGroup) => {
    if (!token || selectedPoId === null) return;
    setDispatching(group.destination_post_office.id);
    setTransitMsg(null);
    try {
      const res = await dispatchBag(
        {
          origin_post_office_id: selectedPoId,
          destination_post_office_id: group.destination_post_office.id,
          consignment_ids: group.consignments.map((c) => c.id),
        },
        token,
      );
      setTransitMsg(
        lang === "hi"
          ? `बैग ${res.bag_number} में ${res.dispatched_count} पार्सल ${res.destination_post_office.name} को रवाना किए गए!`
          : `Dispatched ${res.dispatched_count} parcels in bag ${res.bag_number} to ${res.destination_post_office.name}!`,
      );
      await Promise.all([
        reloadTransit(selectedPoId),
        reloadConsignments(selectedPoId, status, q),
      ]);
    } catch (e) {
      setTransitMsg(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setDispatching(null);
    }
  };

  const handleReceive = async (bagNoToReceive?: string) => {
    const bagNo = bagNoToReceive || receiveInputNo;
    if (!token || selectedPoId === null || !bagNo.trim()) return;
    setReceivingBagNo(bagNo.trim());
    setTransitMsg(null);
    try {
      const res = await receiveBag(
        {
          destination_post_office_id: selectedPoId,
          bag_number: bagNo.trim(),
        },
        token,
      );
      setTransitMsg(
        lang === "hi"
          ? `बैग ${res.bag_number} से ${res.unbagged_count} पार्सल प्राप्त कर खोले गए — आज के डिलीवरी अनुकूलन के लिए तैयार!`
          : `Successfully received & unbagged ${res.unbagged_count} parcels from bag ${res.bag_number} — now confirmed for today's route optimization!`,
      );
      setReceiveInputNo("");
      await Promise.all([
        reloadTransit(selectedPoId),
        reloadRoutes(selectedPoId),
        reloadDashboard(selectedPoId),
        reloadConsignments(selectedPoId, status, q),
      ]);
    } catch (e) {
      setTransitMsg(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setReceivingBagNo(null);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  const confirmedSlotCount = dashboard
    ? Math.max(0, dashboard.total_active - dashboard.pending_slot)
    : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header & Post Office Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink">
              {lang === "hi" ? "डाकघर संचालन व नियंत्रण कक्ष" : "Post Office Operations & Control Room"}
            </h1>
            {isAdmin ? (
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                🌐 Global Admin
              </span>
            ) : (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                🏢 Regional Supervisor
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {lang === "hi"
              ? "क्षेत्रीय रूट अनुकूलन, पार्सल क्लबिंग और अंतर-क्षेत्रीय ट्रांजिट प्रबंधन"
              : "Regional route optimization, parcel clubbing batches, and transit bags"}
          </p>
        </div>

        {/* Region Switcher: Admin has dropdown to any region, Supervisor has fixed regional office */}
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">🏢 Regional Hub:</span>
              <select
                value={selectedPoId ?? ""}
                onChange={(e) => setSelectedPoId(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm focus:border-brand-500 focus:outline-none"
              >
                {postOffices.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.code} · {po.name} ({po.pincode})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">🏢 Office:</span>
              <span className="text-sm font-bold text-ink">
                {currentPo?.name ?? "Assigned Hub"} ({currentPo?.code})
              </span>
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleOptimize}
            disabled={optimizing}
          >
            {optimizing ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner label={t("dashboard.optimizing")} />
              </span>
            ) : (
              `⚡ Optimize ${currentPo?.code ?? ""} Routes`
            )}
          </Button>
        </div>
      </div>

      {optimizeMsg ? (
        <div className="mt-4 animate-fade-in rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 border border-blue-200">
          {optimizeMsg}
        </div>
      ) : null}

      {/* KPI Cards */}
      {dashboard ? (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label={t("dashboard.kpiTotalActive")}
            value={dashboard.total_active}
          />
          <KpiCard
            label={lang === "hi" ? "पुष्ट स्लॉट" : "Confirmed Slots"}
            value={confirmedSlotCount}
            tone="positive"
          />
          <KpiCard
            label={t("dashboard.kpiPendingSlot")}
            value={dashboard.pending_slot}
            tone="warning"
          />
          <KpiCard
            label={t("dashboard.kpiOutForDelivery")}
            value={dashboard.out_for_delivery}
          />
          <KpiCard
            label={t("dashboard.kpiDeliveredToday")}
            value={dashboard.delivered_today}
            tone="positive"
          />
          <KpiCard
            label={t("dashboard.kpiFirstAttempt")}
            value={`${Math.round(dashboard.first_attempt_success_rate)}%`}
            tone="positive"
          />
        </section>
      ) : null}

      {/* Main Tabs */}
      <div className="mt-8 flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("ROUTES")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "ROUTES"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>🗺️ {lang === "hi" ? "क्षेत्रीय डिलीवरी रूट" : "Regional Last-Mile Routes"}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {routes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("TRANSIT")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "TRANSIT"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>👜 {lang === "hi" ? "पार्सल क्लबिंग व ट्रांजिट" : "Inter-Region Transit & Bagging"}</span>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 font-bold">
            {outgoingGroups.length + incomingBags.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("CONSIGNMENTS")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "CONSIGNMENTS"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>📦 {lang === "hi" ? "सभी क्षेत्रीय पार्सल" : "All Regional Parcels"}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {consignments.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Regional Routes & Maps */}
      {activeTab === "ROUTES" && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                {currentPo?.name} — Delivery Routes
              </h2>
              <p className="text-xs text-slate-500">
                {routes.length} {t("dashboard.routes").toLowerCase()} planned today for this serving post office
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
            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-400">
              <p className="text-3xl">🛣️</p>
              <p className="mt-2 text-sm">{t("dashboard.noRoutes")}</p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={handleOptimize}
                disabled={optimizing}
              >
                ⚡ Run Optimizer Now
              </Button>
            </div>
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
      )}

      {/* Tab 2: Inter-Region Transit & Bagging */}
      {activeTab === "TRANSIT" && (
        <section className="mt-6 space-y-8">
          {transitMsg ? (
            <div className="animate-fade-in rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800">
              {transitMsg}
            </div>
          ) : null}

          {/* Incoming Bags Arriving at this Regional Hub */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <span>📥</span> Incoming Transit Bags Arriving at {currentPo?.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Batches dispatched from origin hubs heading to this office. Click Receive to unbag and confirm for today&apos;s routes.
                </p>
              </div>
            </div>

            {incomingBags.length === 0 ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-400 text-sm">
                📭 No in-transit bags currently en route to this office.
              </div>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {incomingBags.map((bag) => {
                  const isReceiving = receivingBagNo === bag.bag_number;
                  return (
                    <div key={bag.bag_number} className="card p-5 border border-indigo-100 bg-indigo-50/30">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="inline-block rounded bg-indigo-600 px-2 py-0.5 font-mono text-xs font-bold text-white">
                            👜 {bag.bag_number}
                          </span>
                          <h4 className="mt-2 text-sm font-bold text-ink">
                            From: {bag.origin_post_office.name} ({bag.origin_post_office.code})
                          </h4>
                          <p className="text-xs text-slate-500">
                            {bag.item_count} parcels · {(bag.total_weight_grams / 1000).toFixed(2)} kg
                          </p>
                        </div>
                        <StatusBadge status="IN_TRANSIT" />
                      </div>

                      <div className="mt-3 rounded bg-white p-2.5 text-xs text-slate-600 font-mono border border-slate-100 truncate">
                        {bag.consignments.map((c) => c.tracking_number).join(", ")}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleReceive(bag.bag_number)}
                          disabled={isReceiving}
                        >
                          {isReceiving ? "Unbagging…" : "⚡ 1-Click Receive & Unbag"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual Receive Input */}
          <div className="card p-4 border border-slate-200 bg-slate-50/60">
            <p className="text-xs font-semibold text-slate-600 uppercase">
              Or Scan / Enter Custom Bag Number to Receive:
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="e.g. BAG-NSK-BOM-882"
                value={receiveInputNo}
                onChange={(e) => setReceiveInputNo(e.target.value)}
                className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-ink uppercase"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleReceive()}
                disabled={receivingBagNo !== null || !receiveInputNo.trim()}
              >
                {receivingBagNo ? "Unbagging…" : "Receive Bag"}
              </Button>
            </div>
          </div>

          {/* Outgoing Parcels Clubbed by Destination */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <span>📤</span> Outgoing Parcels at {currentPo?.name} (Clubbed by Destination Hub)
                </h3>
                <p className="text-xs text-slate-500">
                  Booked parcels submitted at this counter clubbed together to seal into a transit bag.
                </p>
              </div>
            </div>

            {outgoingGroups.length === 0 ? (
              <div className="mt-3 card p-8 text-center text-slate-400">
                <p className="text-2xl">✨</p>
                <p className="mt-2 text-sm">No pending outgoing inter-region parcels at this counter.</p>
              </div>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {outgoingGroups.map((group) => {
                  const dest = group.destination_post_office;
                  const isDispatchingThis = dispatching === dest.id;
                  return (
                    <div key={dest.id} className="card p-5 border border-slate-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-block rounded bg-indigo-50 px-2 py-0.5 font-mono text-xs font-bold text-indigo-700">
                            DEST: {dest.code}
                          </span>
                          <h4 className="mt-1 text-base font-bold text-ink">{dest.name}</h4>
                          <p className="text-xs text-slate-500">PIN: {dest.pincode}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-ink">{group.consignment_count}</span>
                          <p className="text-xs text-slate-400">parcels</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-600">
                        <p>Total Weight: {(group.total_weight_grams / 1000).toFixed(2)} kg</p>
                        <p className="font-mono text-slate-400 mt-1 truncate">
                          {group.consignments.map((c) => c.tracking_number).join(", ")}
                        </p>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => handleDispatch(group)}
                          disabled={isDispatchingThis}
                        >
                          {isDispatchingThis ? "Sealing Bag…" : "👜 Dispatch Transit Bag"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 3: All Consignments */}
      {activeTab === "CONSIGNMENTS" && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Consignments at {currentPo?.name}
              </h2>
              <p className="text-xs text-slate-500">
                {consignments.length} {t("dashboard.consignments").toLowerCase()}
              </p>
            </div>
            <Link href="/consignments/new">
              <Button variant="secondary" size="sm">
                + {t("dashboard.newConsignment")}
              </Button>
            </Link>
          </div>

          <div className="card mt-3 flex flex-wrap items-center gap-3 p-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "" | ConsignmentStatus)}
              className={CONTROL_CLASS}
            >
              <option value="">{t("dashboard.allStatuses")}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
            <input
              type="search"
              placeholder={t("dashboard.searchPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`${CONTROL_CLASS} min-w-[200px] flex-1`}
            />
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
                          {c.bag_number ? (
                            <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">
                              👜 {c.bag_number}
                            </span>
                          ) : null}
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
      )}
    </main>
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
  t: (key: string) => string;
}) {
  const km = ((route.total_distance_m ?? 0) / 1000).toFixed(1);
  const startTime =
    route.planned_start_minutes != null
      ? minutesToLabel(route.planned_start_minutes)
      : null;

  return (
    <div className="card overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {t("dashboard.routeHash")}
            {route.id} · {route.route_date}
          </p>
          <p className="mt-0.5 text-base font-semibold text-ink">
            {route.agent ? route.agent.name : t("dashboard.unassignedAgent")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {route.total_stops} {t("dashboard.stops")} · {km} km
            {startTime ? ` · ${t("dashboard.startsAt")} ${startTime}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onViewOnMap}>
            🗺️ {t("map.viewOnMap")}
          </Button>
          <Button variant="secondary" size="sm" onClick={onToggle}>
            {expanded ? t("dashboard.hideStops") : t("dashboard.viewStops")}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-slate-200 bg-slate-50/50 p-4">
          <ol className="relative space-y-3 border-l border-brand-200 pl-4">
            {route.stops.map((stop) => {
              const c = stop.consignment;
              const slotText = c.confirmed_slot
                ? slotWindowLabel(c.confirmed_slot)
                : null;
              const etaText =
                stop.eta_minutes != null ? minutesToLabel(stop.eta_minutes) : null;

              return (
                <li key={stop.id} className="relative">
                  <span className="absolute -left-[21px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {stop.sequence}
                  </span>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-ink">
                        {c.tracking_number}
                      </span>
                      {etaText ? (
                        <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-medium text-brand-700">
                          {t("dashboard.eta")}: {etaText}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {c.recipient.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.address.line1}, {c.address.locality}
                    </p>
                    {slotText ? (
                      <p className="mt-1 text-xs text-brand-700">
                        {t("dashboard.slotWindow")}: {slotText}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
