"use client";

import { useI18n } from "@/lib/i18n";
import type {
  ConsignmentStatus,
  RouteStatus,
  StopStatus,
} from "@/lib/api";

export type BadgeKind = "consignment" | "route" | "stop";

const CONSIGNMENT_CLASSES: Record<ConsignmentStatus, string> = {
  BOOKED: "bg-slate-100 text-slate-700",
  RECEIVED_AT_ORIGIN: "bg-blue-50 text-blue-700 font-semibold",
  COLLECTED: "bg-slate-100 text-slate-700",
  SORTED: "bg-sky-50 text-sky-700",
  IN_TRANSIT: "bg-indigo-50 text-indigo-700 font-semibold",
  RECEIVED_AT_DESTINATION: "bg-purple-50 text-purple-700 font-semibold",
  SLOT_PENDING: "bg-amber-50 text-amber-700",
  SLOT_CONFIRMED: "bg-brand-50 text-brand-700",
  OUT_FOR_DELIVERY: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  DELIVERY_FAILED: "bg-red-50 text-accent",
  RESCHEDULED: "bg-amber-50 text-amber-700",
  RETURNED: "bg-slate-100 text-slate-600",
};

const ROUTE_CLASSES: Record<RouteStatus, string> = {
  PLANNED: "bg-slate-100 text-slate-700",
  DISPATCHED: "bg-sky-50 text-sky-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
};

const STOP_CLASSES: Record<StopStatus, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  ARRIVED: "bg-sky-50 text-sky-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-accent",
  SKIPPED: "bg-amber-50 text-amber-700",
};

function classesFor(kind: BadgeKind, status: string): string {
  if (kind === "route") {
    return ROUTE_CLASSES[status as RouteStatus] ?? "bg-slate-100 text-slate-700";
  }
  if (kind === "stop") {
    return STOP_CLASSES[status as StopStatus] ?? "bg-slate-100 text-slate-700";
  }
  return (
    CONSIGNMENT_CLASSES[status as ConsignmentStatus] ??
    "bg-slate-100 text-slate-700"
  );
}

function labelKey(kind: BadgeKind): string {
  if (kind === "route") return "routeStatus";
  if (kind === "stop") return "stopStatus";
  return "status";
}

export function StatusBadge({
  status,
  kind = "consignment",
  className = "",
}: {
  status: ConsignmentStatus | RouteStatus | StopStatus;
  kind?: BadgeKind;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${classesFor(
        kind,
        status,
      )} ${className}`}
    >
      {t(`${labelKey(kind)}.${status}`)}
    </span>
  );
}
