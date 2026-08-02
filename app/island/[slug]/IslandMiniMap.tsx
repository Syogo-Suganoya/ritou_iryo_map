"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Facility } from "@/lib/gap";

const GSI_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    gsi: {
      type: "raster",
      tiles: ["https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
    },
  },
  layers: [{ id: "gsi", type: "raster", source: "gsi" }],
};

export default function IslandMiniMap({
  center,
  facilities,
}: {
  center: { lat: number; lng: number };
  facilities: Facility[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: GSI_STYLE,
      center: [center.lng, center.lat],
      zoom: 11,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__map = map;
    }
    map.on("load", () => {
      map.resize();
      map.addSource("facilities", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: facilities.map((f) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [f.lng, f.lat] },
            properties: { name: f.name, is_emergency: f.is_emergency },
          })),
        },
      });
      map.addLayer({
        id: "facilities-pin",
        type: "circle",
        source: "facilities",
        paint: {
          "circle-radius": ["case", ["get", "is_emergency"], 9, 7],
          "circle-color": ["case", ["get", "is_emergency"], "#dc2626", "#0d9488"],
          "circle-opacity": 0.95,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.on("click", "facilities-pin", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; is_emergency: boolean };
        new maplibregl.Popup({ offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-weight:bold">${p.is_emergency ? "🚑 " : "🏥 "}${p.name}</div>`)
          .addTo(map);
      });
      if (facilities.length) {
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend([center.lng, center.lat]);
        facilities.forEach((f) => bounds.extend([f.lng, f.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 12.5 });
      }
    });
    return () => {
      map.remove();
    };
  }, [center, facilities]);

  return (
    <div
      ref={containerRef}
      className="h-[320px] overflow-hidden border"
      style={{ borderColor: "var(--parchment-line)" }}
    />
  );
}
