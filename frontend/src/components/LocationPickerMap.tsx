"use client";

import { useEffect, useRef, useState } from "react";
import { loadLeaflet } from "./LeafletLoader";
import { reverseGeocode, listLocalities, type LocalityPreset } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/* eslint-disable @typescript-eslint/no-explicit-any */

const NASHIK_DEFAULT = { lat: 19.9975, lng: 73.7898 };

interface LocationPickerMapProps {
  latitude: number | null;
  longitude: number | null;
  locality?: string;
  onLocationSelect: (loc: {
    latitude: number;
    longitude: number;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
  }) => void;
}

export function LocationPickerMap({
  latitude,
  longitude,
  locality,
  onLocationSelect,
}: LocationPickerMapProps) {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [loadingMap, setLoadingMap] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [presets, setPresets] = useState<LocalityPreset[]>([]);
  const [activeLocality, setActiveLocality] = useState(locality || "");

  // Load presets on mount
  useEffect(() => {
    listLocalities()
      .then(setPresets)
      .catch(() => {
        // Fallback default presets if API call is interrupted
        setPresets([
          { locality: "Panchavati", city: "Nashik", state: "Maharashtra", pincode: "422003", latitude: 20.011, longitude: 73.7929 },
          { locality: "College Road", city: "Nashik", state: "Maharashtra", pincode: "422005", latitude: 19.9975, longitude: 73.757 },
          { locality: "Gangapur Road", city: "Nashik", state: "Maharashtra", pincode: "422005", latitude: 20.005, longitude: 73.75 },
          { locality: "Indira Nagar", city: "Nashik", state: "Maharashtra", pincode: "422009", latitude: 19.972, longitude: 73.768 },
          { locality: "CIDCO", city: "Nashik", state: "Maharashtra", pincode: "422009", latitude: 19.964, longitude: 73.748 },
          { locality: "Satpur", city: "Nashik", state: "Maharashtra", pincode: "422007", latitude: 19.999, longitude: 73.715 },
          { locality: "Nashik Road", city: "Nashik", state: "Maharashtra", pincode: "422101", latitude: 19.945, longitude: 73.838 },
        ]);
      });
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    let isCancelled = false;

    loadLeaflet()
      .then((L) => {
        if (isCancelled || !mapContainerRef.current) return;

        // Prevent double init
        if (mapInstanceRef.current) return;

        const initialLat = latitude ?? NASHIK_DEFAULT.lat;
        const initialLng = longitude ?? NASHIK_DEFAULT.lng;
        const initialZoom = latitude && longitude ? 15 : 13;

        const map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: initialZoom,
          zoomControl: false,
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);

        // OpenStreetMap tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Custom red pin icon
        const pinIcon = L.divIcon({
          className: "custom-map-pin",
          html: `
            <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 32px; height: 32px; background: #dc2626; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
                <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%;"></div>
              </div>
              <div style="position: absolute; bottom: -4px; width: 14px; height: 4px; background: rgba(0,0,0,0.25); border-radius: 50%; filter: blur(1px);"></div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 34],
        });

        // Add draggable marker
        const marker = L.marker([initialLat, initialLng], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        markerRef.current = marker;

        const handlePointSelected = async (lat: number, lng: number) => {
          marker.setLatLng([lat, lng]);
          setLookingUp(true);
          try {
            const rev = await reverseGeocode(lat, lng);
            setActiveLocality(rev.locality);
            onLocationSelect({
              latitude: lat,
              longitude: lng,
              locality: rev.locality,
              city: rev.city,
              state: rev.state,
              pincode: rev.pincode,
            });
          } catch {
            onLocationSelect({
              latitude: lat,
              longitude: lng,
            });
          } finally {
            setLookingUp(false);
          }
        };

        // Click on map to place pin
        map.on("click", (e: any) => {
          handlePointSelected(e.latlng.lat, e.latlng.lng);
        });

        // Drag marker
        marker.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          handlePointSelected(pos.lat, pos.lng);
        });

        mapInstanceRef.current = map;
        setLoadingMap(false);
      })
      .catch((err) => {
        console.error("Map initialization failed", err);
        setLoadingMap(false);
      });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When external latitude/longitude change, update map center & marker
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    if (latitude != null && longitude != null) {
      const cur = markerRef.current.getLatLng();
      if (Math.abs(cur.lat - latitude) > 0.0001 || Math.abs(cur.lng - longitude) > 0.0001) {
        markerRef.current.setLatLng([latitude, longitude]);
        mapInstanceRef.current.panTo([latitude, longitude], { animate: true });
      }
    }
  }, [latitude, longitude]);

  // Quick preset click handler
  const handleSelectPreset = (preset: LocalityPreset) => {
    setActiveLocality(preset.locality);
    if (mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([preset.latitude, preset.longitude]);
      mapInstanceRef.current.setView([preset.latitude, preset.longitude], 15, { animate: true });
    }
    onLocationSelect({
      latitude: preset.latitude,
      longitude: preset.longitude,
      locality: preset.locality,
      city: preset.city,
      state: preset.state,
      pincode: preset.pincode,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          📍 {t("map.clickToPick")}
        </label>
        <div className="flex items-center gap-2">
          {lookingUp ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600"></span>
              {t("map.reverseGeocoding")}
            </span>
          ) : latitude && longitude ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-mono font-medium text-emerald-700">
              {latitude.toFixed(4)}, {longitude.toFixed(4)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Quick Locality Presets */}
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1">{t("map.quickPresets")}:</span>
          {presets.map((p) => {
            const isSelected = activeLocality.toLowerCase() === p.locality.toLowerCase();
            return (
              <button
                key={p.locality}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-brand-600 text-white shadow-sm ring-2 ring-brand-300"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {p.locality}
              </button>
            );
          })}
        </div>
      )}

      {/* Interactive Map Container */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner">
        <div
          ref={mapContainerRef}
          className="h-64 sm:h-72 w-full z-0"
          style={{ minHeight: "260px" }}
        />

        {loadingMap && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"></div>
              <p className="text-xs font-medium text-slate-600">{t("common.loading")}</p>
            </div>
          </div>
        )}

        {/* Map overlay helper text */}
        <div className="absolute bottom-2 left-2 z-[400] rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm pointer-events-none">
          👆 Click anywhere on the map or drag the pin to set delivery coordinates
        </div>
      </div>
    </div>
  );
}
