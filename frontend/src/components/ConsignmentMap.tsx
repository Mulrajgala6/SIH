"use client";

import { useEffect, useRef, useState } from "react";
import { loadLeaflet } from "./LeafletLoader";
import { useI18n } from "@/lib/i18n";
import { type AddressOut } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

const NASHIK_HO = {
  lat: 19.9975,
  lng: 73.7898,
  name: "Nashik Head Post Office (NSK-HO)",
};

interface ConsignmentMapProps {
  address: AddressOut;
  recipientName: string;
  trackingNumber: string;
}

export function ConsignmentMap({
  address,
  recipientName,
  trackingNumber,
}: ConsignmentMapProps) {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [loadingMap, setLoadingMap] = useState(true);

  const lat = address.latitude ?? NASHIK_HO.lat;
  const lng = address.longitude ?? NASHIK_HO.lng;
  const hasExactCoords = address.latitude != null && address.longitude != null;

  useEffect(() => {
    let isCancelled = false;

    loadLeaflet()
      .then((L) => {
        if (isCancelled || !mapContainerRef.current) return;
        if (mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 14,
          zoomControl: false,
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Destination Marker
        const destIcon = L.divIcon({
          className: "custom-dest-pin",
          html: `
            <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 32px; height: 32px; background: #dc2626; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
                <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%;"></div>
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 34],
        });

        const destMarker = L.marker([lat, lng], { icon: destIcon }).addTo(map);
        destMarker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4;">
            <strong style="color: #dc2626; font-size: 14px;">📍 Delivery Location</strong><br/>
            <strong>${recipientName}</strong> (${trackingNumber})<br/>
            <span style="color: #475569; font-size: 12px;">${address.line1}, ${address.locality}</span>
          </div>
        `).openPopup();

        // Depot Marker
        const depotIcon = L.divIcon({
          className: "custom-depot-pin",
          html: `
            <div style="width: 32px; height: 32px; background: #991b1b; border: 2px solid #ffffff; border-radius: 8px; box-shadow: 0 3px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">
              🏢
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const depotMarker = L.marker([NASHIK_HO.lat, NASHIK_HO.lng], {
          icon: depotIcon,
        }).addTo(map);
        depotMarker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <strong style="color: #991b1b;">🏢 ${NASHIK_HO.name}</strong><br/>
            <span>Serving Depot</span>
          </div>
        `);

        // Connect Depot to Destination
        const line = L.polyline(
          [
            [NASHIK_HO.lat, NASHIK_HO.lng],
            [lat, lng],
          ],
          {
            color: "#2563eb",
            weight: 3,
            dashArray: "6, 8",
            opacity: 0.75,
          },
        ).addTo(map);

        const bounds = L.latLngBounds([
          [NASHIK_HO.lat, NASHIK_HO.lng],
          [lat, lng],
        ]);
        map.fitBounds(bounds, { padding: [40, 40] });

        mapInstanceRef.current = map;
        setLoadingMap(false);
      })
      .catch((err) => {
        console.error("ConsignmentMap init error", err);
        setLoadingMap(false);
      });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, recipientName, trackingNumber, address]);

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700">
        <span className="flex items-center gap-1.5">
          <span>📍</span> {t("detail.coordinates")}
        </span>
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
        >
          <span>🧭</span> {t("map.openNavigation")} ↗
        </a>
      </div>

      <div className="relative">
        <div
          ref={mapContainerRef}
          className="h-56 w-full z-0"
          style={{ minHeight: "220px" }}
        />

        {loadingMap && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 backdrop-blur-sm z-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"></div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-5 py-3 text-xs text-slate-500 border-t border-slate-100">
        <span>
          {hasExactCoords ? (
            <span className="text-emerald-700 font-medium">✓ Precision GPS location</span>
          ) : (
            <span>Locality centroid</span>
          )}
        </span>
        <span className="font-mono text-slate-600">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
      </div>
    </div>
  );
}
