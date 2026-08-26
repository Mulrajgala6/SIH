"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadLeaflet } from "./LeafletLoader";
import { useI18n, pickLang } from "@/lib/i18n";
import {
  minutesToLabel,
  slotWindowLabel,
  type ConsignmentBrief,
  type RouteOut,
  type RouteStopOut,
} from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ROUTE_PALETTE = [
  "#2563eb", // Blue
  "#7c3aed", // Purple
  "#059669", // Emerald
  "#d97706", // Amber
  "#db2777", // Pink
  "#0891b2", // Cyan
];

const NASHIK_HO = {
  lat: 19.9975,
  lng: 73.7898,
  name: "Nashik Head Post Office (NSK-HO)",
};

interface RouteMapProps {
  routes: RouteOut[];
  unassignedConsignments?: ConsignmentBrief[];
  selectedRouteId?: number | null;
  onSelectRoute?: (routeId: number | null) => void;
}

export function RouteMap({
  routes,
  unassignedConsignments = [],
  selectedRouteId,
  onSelectRoute,
}: RouteMapProps) {
  const { t, lang } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  const [filterRouteId, setFilterRouteId] = useState<number | "ALL">(
    selectedRouteId ?? "ALL",
  );
  const [loadingMap, setLoadingMap] = useState(true);

  // Sync prop changes to local filter
  useEffect(() => {
    if (selectedRouteId !== undefined) {
      setFilterRouteId(selectedRouteId ?? "ALL");
    }
  }, [selectedRouteId]);

  // Initialize Map
  useEffect(() => {
    let isCancelled = false;

    loadLeaflet()
      .then((L) => {
        if (isCancelled || !mapContainerRef.current) return;
        if (mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: [NASHIK_HO.lat, NASHIK_HO.lng],
          zoom: 13,
          zoomControl: false,
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        layerGroupRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        setLoadingMap(false);
      })
      .catch((err) => {
        console.error("Failed to load map in RouteMap", err);
        setLoadingMap(false);
      });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render Routes and Stops whenever routes or filter change
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    loadLeaflet().then((L) => {
      const layerGroup = layerGroupRef.current;
      layerGroup.clearLayers();

      const displayedRoutes =
        filterRouteId === "ALL"
          ? routes
          : routes.filter((r) => r.id === filterRouteId);

      const allLatLngs: [number, number][] = [];

      // 1. Plot Post Office Depots
      const depotPositions = new Set<string>();

      displayedRoutes.forEach((route) => {
        const po = route.post_office;
        const depotLat = po?.latitude ?? NASHIK_HO.lat;
        const depotLng = po?.longitude ?? NASHIK_HO.lng;
        const key = `${depotLat},${depotLng}`;

        if (!depotPositions.has(key)) {
          depotPositions.add(key);
          allLatLngs.push([depotLat, depotLng]);

          const depotIcon = L.divIcon({
            className: "custom-depot-icon",
            html: `
              <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px;">
                <div style="width: 38px; height: 38px; background: #991b1b; border: 3px solid #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">
                  🏢
                </div>
                <div style="position: absolute; -top: 6px; -right: 6px; background: #eab308; color: #000; font-weight: 800; font-size: 9px; padding: 1px 4px; border-radius: 4px; border: 1px solid white;">
                  DEPOT
                </div>
              </div>
            `,
            iconSize: [42, 42],
            iconAnchor: [21, 21],
          });

          const depotMarker = L.marker([depotLat, depotLng], { icon: depotIcon });
          depotMarker.bindPopup(`
            <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4;">
              <strong style="color: #991b1b; font-size: 14px;">🏢 ${po?.name ?? NASHIK_HO.name}</strong><br/>
              <span style="color: #64748b;">Post Office Depot · Serving Center</span>
            </div>
          `);
          layerGroup.addLayer(depotMarker);
        }
      });

      // 2. Plot Route Polylines and Stops
      displayedRoutes.forEach((route, routeIdx) => {
        const color = ROUTE_PALETTE[routeIdx % ROUTE_PALETTE.length];
        const po = route.post_office;
        const depotLat = po?.latitude ?? NASHIK_HO.lat;
        const depotLng = po?.longitude ?? NASHIK_HO.lng;

        const routePoints: [number, number][] = [[depotLat, depotLng]];

        // Sort stops by sequence
        const sortedStops = [...route.stops].sort((a, b) => a.sequence - b.sequence);

        sortedStops.forEach((stop) => {
          const c = stop.consignment;
          const lat = c.address.latitude;
          const lng = c.address.longitude;

          if (lat != null && lng != null) {
            routePoints.push([lat, lng]);
            allLatLngs.push([lat, lng]);

            // Determine status color
            let statusBg = color;
            if (stop.status === "COMPLETED") statusBg = "#16a34a"; // Green
            else if (stop.status === "FAILED") statusBg = "#dc2626"; // Red
            else if (stop.status === "ARRIVED") statusBg = "#d97706"; // Amber

            const stopIcon = L.divIcon({
              className: "custom-stop-icon",
              html: `
                <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
                  <div style="width: 30px; height: 30px; background: ${statusBg}; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 3px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px;">
                    ${stop.sequence}
                  </div>
                </div>
              `,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            });

            const stopMarker = L.marker([lat, lng], { icon: stopIcon });

            const slot = c.confirmed_slot;
            const slotText = slot
              ? `${pickLang(lang, slot.label_en, slot.label_hi)} (${slotWindowLabel(slot)})`
              : "No slot specified";

            const etaText =
              stop.eta_minutes != null ? minutesToLabel(stop.eta_minutes) : "—";

            const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

            stopMarker.bindPopup(`
              <div style="font-family: sans-serif; font-size: 13px; line-height: 1.5; min-width: 220px;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
                  <span style="font-weight: 700; color: #0f172a; font-size: 14px;">Stop #${stop.sequence}</span>
                  <span style="background: ${color}20; color: ${color}; font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 4px;">
                    ${route.agent?.name ?? "Route " + route.id}
                  </span>
                </div>
                <div style="font-weight: 600; color: #1e293b;">👤 ${c.recipient.name}</div>
                <div style="color: #475569; font-size: 12px;">📍 ${c.address.line1}, ${c.address.locality}</div>
                <div style="color: #64748b; font-size: 12px; margin-top: 4px;">
                  ⏰ <strong>Slot:</strong> ${slotText}<br/>
                  🎯 <strong>ETA:</strong> ${etaText}
                </div>
                <div style="margin-top: 10px; display: flex; gap: 6px; justify-content: space-between;">
                  <a href="/consignments/${c.id}" style="color: #0369a1; text-decoration: none; font-size: 12px; font-weight: 600;">
                    📦 View Parcel
                  </a>
                  <a href="${navUrl}" target="_blank" rel="noopener noreferrer" style="background: #2563eb; color: white; text-decoration: none; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">
                    🧭 Navigate
                  </a>
                </div>
              </div>
            `);

            layerGroup.addLayer(stopMarker);
          }
        });

        // Add return to depot to complete loop
        if (routePoints.length > 1) {
          routePoints.push([depotLat, depotLng]);
        }

        // Draw Polyline for this route
        if (routePoints.length > 1) {
          const polyline = L.polyline(routePoints, {
            color: color,
            weight: 4,
            opacity: 0.85,
            dashArray: route.status === "COMPLETED" ? undefined : "6, 8",
            lineJoin: "round",
          });
          layerGroup.addLayer(polyline);
        }
      });

      // 3. Plot Unassigned Consignments
      if (unassignedConsignments.length > 0) {
        unassignedConsignments.forEach((uc) => {
          if (uc.address.latitude != null && uc.address.longitude != null) {
            allLatLngs.push([uc.address.latitude, uc.address.longitude]);

            const unassignedIcon = L.divIcon({
              className: "custom-unassigned-icon",
              html: `
                <div style="width: 26px; height: 26px; background: #f97316; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                  📦
                </div>
              `,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            });

            const uMarker = L.marker(
              [uc.address.latitude, uc.address.longitude],
              { icon: unassignedIcon },
            );

            uMarker.bindPopup(`
              <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4;">
                <strong style="color: #ea580c;">⚠️ Unassigned Consignment</strong><br/>
                <span>${uc.tracking_number} · ${uc.recipient.name}</span><br/>
                <span style="color: #64748b; font-size: 12px;">${uc.address.locality}</span><br/>
                <a href="/consignments/${uc.id}" style="color: #0284c7; font-size: 12px; font-weight: 600; display: inline-block; margin-top: 4px;">
                  View Consignment
                </a>
              </div>
            `);

            layerGroup.addLayer(uMarker);
          }
        });
      }

      // Fit map bounds to encompass all points
      if (allLatLngs.length > 0) {
        const bounds = L.latLngBounds(allLatLngs);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    });
  }, [routes, unassignedConsignments, filterRouteId, lang]);

  const handleRouteChange = (val: string) => {
    const routeId = val === "ALL" ? "ALL" : Number(val);
    setFilterRouteId(routeId);
    if (onSelectRoute) {
      onSelectRoute(routeId === "ALL" ? null : routeId);
    }
  };

  const activeRoute =
    filterRouteId !== "ALL"
      ? routes.find((r) => r.id === filterRouteId)
      : null;

  return (
    <div className="card overflow-hidden">
      {/* Map Toolbar / Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm">
            🗺️
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {t("map.routeMapTitle")}
            </h3>
            <p className="text-xs text-slate-500">
              {routes.length} {t("dashboard.routes").toLowerCase()} ·{" "}
              {routes.reduce((acc, r) => acc + r.total_stops, 0)}{" "}
              {t("dashboard.stops").toLowerCase()}
            </p>
          </div>
        </div>

        {/* Route Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="route-filter" className="text-xs text-slate-500">
            {t("map.filterRoute")}:
          </label>
          <select
            id="route-filter"
            value={filterRouteId}
            onChange={(e) => handleRouteChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="ALL">🌐 {t("map.allRoutes")}</option>
            {routes.map((r, idx) => (
              <option key={r.id} value={r.id}>
                Route #{r.id} ({r.agent?.name ?? "Agent"}, {r.total_stops} stops)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Interactive Map Box */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          className="h-[440px] sm:h-[500px] w-full z-0"
          style={{ minHeight: "440px" }}
        />

        {loadingMap && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"></div>
              <p className="text-xs font-medium text-slate-600">{t("common.loading")}</p>
            </div>
          </div>
        )}

        {/* Route Legend Overlay */}
        <div className="absolute bottom-3 left-3 z-[400] max-w-xs rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur-sm border border-slate-200/80 text-xs">
          <p className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1">
            <span>🧭</span> Route Legend
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded bg-red-800 flex items-center justify-center text-[9px] text-white">
                🏢
              </span>
              <span className="text-slate-600">{t("map.depot")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full bg-blue-600 flex items-center justify-center text-[9px] text-white font-bold">
                #
              </span>
              <span className="text-slate-600">{t("map.stop")} (Sequenced)</span>
            </div>
            {unassignedConsignments.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full bg-orange-500 flex items-center justify-center text-[9px] text-white">
                  📦
                </span>
                <span className="text-slate-600">
                  {unassignedConsignments.length} {t("map.unassignedParcels")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Route Summary Banner (if filtered) */}
      {activeRoute && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-800">
              Route #{activeRoute.id} · {activeRoute.agent?.name ?? "Postman"}
            </span>
            <span className="text-slate-500">
              {activeRoute.total_stops} {t("dashboard.stops").toLowerCase()} ·{" "}
              {activeRoute.total_distance_m
                ? (activeRoute.total_distance_m / 1000).toFixed(1)
                : "—"}{" "}
              km
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleRouteChange("ALL")}
            className="text-brand-700 font-medium hover:underline"
          >
            ← {t("map.allRoutes")}
          </button>
        </div>
      )}
    </div>
  );
}
