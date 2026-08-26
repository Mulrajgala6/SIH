/**
 * Dynamic Leaflet loader for Next.js.
 * Loads Leaflet CSS and JS on demand in the browser without requiring npm bundle dependencies.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

let leafletPromise: Promise<any> | null = null;

export function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet can only load in the browser"));
  }

  if ((window as any).L) {
    return Promise.resolve((window as any).L);
  }

  if (leafletPromise) {
    return leafletPromise;
  }

  leafletPromise = new Promise((resolve, reject) => {
    // 1. Inject Leaflet CSS if not already present
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    // 2. Inject Leaflet JS if not already present
    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
      script.crossOrigin = "";
      script.onload = () => {
        if ((window as any).L) {
          resolve((window as any).L);
        } else {
          reject(new Error("Leaflet script loaded but window.L is undefined"));
        }
      };
      script.onerror = () => {
        reject(new Error("Failed to load Leaflet script from CDN"));
      };
      document.body.appendChild(script);
    } else {
      // Script already added, poll for window.L
      const interval = setInterval(() => {
        if ((window as any).L) {
          clearInterval(interval);
          resolve((window as any).L);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        if ((window as any).L) {
          resolve((window as any).L);
        } else {
          reject(new Error("Timed out waiting for Leaflet"));
        }
      }, 5000);
    }
  });

  return leafletPromise;
}
