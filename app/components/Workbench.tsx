"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  LEVELS,
  LEGEND_ORDER,
  gapLevel,
  gapReasons,
  type AreaGap,
  type Facility,
} from "@/lib/gap";
import AreaDetailPanel from "./AreaDetailPanel";

const GSI_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://glyphs.geolonia.com/{fontstack}/{range}.pbf",
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

const CIRCLE_COLOR: maplibregl.ExpressionSpecification = [
  "match",
  ["get", "level"],
  "critical", LEVELS.critical.color,
  "high", LEVELS.high.color,
  "moderate", LEVELS.moderate.color,
  "low", LEVELS.low.color,
  "#94a3b8",
];

const VIEWS: { key: string; label: string; bounds: [number, number, number, number] }[] = [
  { key: "izu", label: "伊豆諸島", bounds: [138.8, 32.2, 140.1, 34.95] },
  { key: "ogasawara", label: "小笠原", bounds: [141.9, 26.5, 142.4, 27.3] },
  { key: "nishitama", label: "西多摩", bounds: [138.95, 35.6, 139.35, 35.95] },
];

type Tab = "map" | "compare" | "priority";
const TABS: { key: Tab; label: string }[] = [
  { key: "map", label: "地図＋ランキング" },
  { key: "compare", label: "人口対比" },
  { key: "priority", label: "優先エリア提案" },
];

export default function Workbench() {
  const [islands, setIslands] = useState<AreaGap[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(0);
  const [view, setView] = useState("izu");
  const [tab, setTab] = useState<Tab>("map");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  // 一覧に戻ったとき、どれを見ていたかを示し続けるために直前の選択を覚えておく
  const [lastSlug, setLastSlug] = useState<string | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const sideRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/islands")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setIslands(d.islands)))
      .catch(() => setError("エリア情報の取得に失敗しました"));
    fetch("/api/facilities")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setFacilities(d.facilities)))
      .catch(() => setError("医療機関情報の取得に失敗しました"));
    const applyHash = () => {
      const h = window.location.hash.replace("#", "");
      setTab(h === "compare" || h === "priority" ? h : "map");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const ranked = useMemo(
    () => [...islands].sort((a, b) => Number(a.priority_rank) - Number(b.priority_rank)),
    [islands]
  );
  const selectedArea = useMemo(
    () => ranked.find((a) => a.slug === selectedSlug) ?? null,
    [ranked, selectedSlug]
  );

  // 選択の入口は一覧・地図バブル・優先エリア表の3か所。lastSlug は一覧へ戻ったときの
  // ハイライトと復帰位置に使うので、選択時に必ず一緒に更新する
  function selectArea(slug: string) {
    setSelectedSlug(slug);
    setLastSlug(slug);
  }

  function selectTab(t: Tab) {
    setTab(t);
    history.replaceState(null, "", t === "map" ? "#" : `#${t}`);
  }

  // 地図初期化（タブ切替では破棄せず、表示/非表示のみ切り替える）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: GSI_STYLE,
      center: [139.5, 33.8],
      zoom: 7,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      map.resize();
      map.addSource("islands", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("facilities", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "islands-bubble",
        type: "circle",
        source: "islands",
        paint: {
          "circle-radius": ["+", 7, ["*", 0.16, ["sqrt", ["get", "population"]]]],
          "circle-color": CIRCLE_COLOR,
          "circle-opacity": 0.55,
          "circle-stroke-width": 2,
          "circle-stroke-color": CIRCLE_COLOR,
        },
      });
      map.addLayer({
        id: "islands-label",
        type: "symbol",
        source: "islands",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-offset": [0, 1.8],
          "text-font": ["Noto Sans CJK JP Regular"],
        },
        paint: {
          "text-color": "#334155",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });
      map.addLayer({
        id: "facilities-pin",
        type: "circle",
        source: "facilities",
        minzoom: 8.5,
        paint: {
          "circle-radius": ["case", ["get", "is_emergency"], 8, 6],
          "circle-color": ["case", ["get", "is_emergency"], "#dc2626", "#0d9488"],
          "circle-opacity": 0.95,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "islands-bubble", (e) => {
        const pins = map.queryRenderedFeatures(e.point, { layers: ["facilities-pin"] });
        if (pins.length) return;
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        popupRef.current?.remove();
        // selectArea は setState を呼ぶだけで参照が安定しているため、
        // 初回のみ実行されるこの効果内から直接呼んでよい
        selectArea(p.slug);
        setTab("map");
      });
      map.on("click", "facilities-pin", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string | boolean>;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-weight:bold">${p.is_emergency ? "🚑 " : "🏥 "}${p.name}</div>` +
              `<div style="font-size:12px;color:#555">${p.address}</div>` +
              (p.phone ? `<div style="font-size:12px;color:#555">☎ ${p.phone}</div>` : "") +
              (p.is_emergency
                ? `<div style="font-size:12px;color:#dc2626">救急告示医療機関</div>`
                : "")
          )
          .addTo(map);
      });
      for (const layer of ["islands-bubble", "facilities-pin"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
      setMapReady((n) => n + 1);
    });
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__map = map;
    }
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.getSource<maplibregl.GeoJSONSource>("islands")?.setData({
      type: "FeatureCollection",
      features: islands.map((a) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [a.lng, a.lat] },
        properties: {
          slug: a.slug,
          name: a.name,
          population: a.population,
          facility_count: Number(a.facility_count),
          emergency_count: Number(a.emergency_count),
          gap_score: Number(a.gap_score),
          priority_rank: Number(a.priority_rank),
          level: gapLevel(Number(a.gap_score)),
        },
      })),
    });
    map.getSource<maplibregl.GeoJSONSource>("facilities")?.setData({
      type: "FeatureCollection",
      features: facilities.map((f) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [f.lng, f.lat] },
        properties: {
          name: f.name,
          address: f.address,
          phone: f.phone,
          is_emergency: f.is_emergency,
        },
      })),
    });
  }, [islands, facilities, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const v = VIEWS.find((v) => v.key === view);
    if (v) map.fitBounds(v.bounds, { padding: 40, duration: 800 });
  }, [view, mapReady]);

  // 一覧・地図ピンからの選択でマップを注視点に寄せる
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedArea) return;
    map.flyTo({ center: [selectedArea.lng, selectedArea.lat], zoom: Math.max(map.getZoom(), 9), duration: 600 });
  }, [selectedArea, mapReady]);

  // 詳細に切り替わったとき、それが視界に入るようにする
  // （lg以上は右カラム自身がスクロール領域、lg未満は地図の下に積まれるためページごと送る）
  useEffect(() => {
    const el = sideRef.current;
    if (!el) return;
    if (selectedSlug) {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        el.scrollTop = 0;
      } else {
        // smooth は環境（reduced motion 等）によっては無視されスクロールごと起きないため、
        // 確実に詳細まで送れる即時スクロールにする
        el.scrollIntoView({ block: "start" });
      }
    } else if (lastSlug) {
      // 一覧へ戻ったら、見ていた項目まで送り返す（先頭に飛ばされると位置を見失うため）
      el.querySelector(`[data-slug="${lastSlug}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedSlug, lastSlug]);

  // タブが地図に戻った時にキャンバスサイズを再計測
  useEffect(() => {
    if (tab === "map") {
      requestAnimationFrame(() => mapRef.current?.resize());
    }
  }, [tab]);

  const chartData = ranked.map((a) => ({
    name: a.name,
    gap_score: Number(a.gap_score),
    population: a.population,
    facility_count: Number(a.facility_count),
    level: gapLevel(Number(a.gap_score)),
  }));
  const top = ranked[0];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            className="border px-4 py-2 text-sm font-bold eyebrow"
            style={
              tab === t.key
                ? { background: "var(--accent-bright)", color: "var(--ink)", borderColor: "var(--accent-bright)" }
                : { color: "var(--text-parchment-muted)", borderColor: "var(--ink-line-strong)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

      {/* 地図タブ：常時マウントし、非表示時はCSSで隠すのみ（WebGLコンテキストを保持） */}
      <div className={tab === "map" ? "space-y-3" : "hidden"}>
        <div className="flex flex-wrap items-center gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className="border px-3 py-1 text-sm font-bold eyebrow"
              style={
                view === v.key
                  ? { background: "var(--accent-bright)", color: "var(--ink)", borderColor: "var(--accent-bright)" }
                  : { color: "var(--text-parchment-muted)", borderColor: "var(--ink-line-strong)" }
              }
            >
              {v.label}
            </button>
          ))}
          <span className="text-xs ml-1" style={{ color: "var(--text-parchment-muted)" }}>
            ※小笠原は本土から約1,000km南
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs panel-ink px-3 py-2">
          {LEGEND_ORDER.map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: LEVELS[l].color }} />
              {LEVELS[l].label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 pl-3" style={{ borderLeft: "1px solid var(--ink-line)" }}>
            <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: "#dc2626" }} />
            救急医療機関
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: "#0d9488" }} />
            診療所等
          </span>
        </div>
        <div className="grid lg:grid-cols-5 gap-4">
          <div
            ref={containerRef}
            className="lg:col-span-3 h-[420px] lg:h-[600px] overflow-hidden border"
            style={{ borderColor: "var(--ink-line)" }}
          />
          {/* 一覧と詳細は排他表示。詳細を一覧の下に積むと、選んでも画面外に出てしまうため */}
          <div
            ref={sideRef}
            className="lg:col-span-2 lg:h-[600px] lg:overflow-y-auto lg:pr-1 space-y-3"
          >
          {selectedArea ? (
            <AreaDetailPanel
              area={selectedArea}
              facilities={facilities.filter((f) => f.area_slug === selectedArea.slug)}
              onClose={() => setSelectedSlug(null)}
            />
          ) : (
          <ul className="space-y-2">
            {ranked.map((a) => {
              const lv = LEVELS[gapLevel(Number(a.gap_score))];
              const active = a.slug === (selectedSlug ?? lastSlug);
              return (
                <li key={a.slug} data-slug={a.slug}>
                  <button
                    onClick={() => selectArea(a.slug)}
                    className="panel panel-hover block w-full text-left p-3"
                    style={active ? { borderColor: "var(--accent)", background: "var(--parchment-deep)" } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{a.name}</span>
                      <span className="font-data text-xs shrink-0" style={{ color: "var(--text-ink-muted)" }}>
                        優先度 {Number(a.priority_rank)}位
                      </span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-ink-muted)" }}>
                      人口 {a.population.toLocaleString()}人 / 医療機関{" "}
                      {Number(a.facility_count)}か所（救急 {Number(a.emergency_count)}）
                    </div>
                    <span className={`chip mt-1.5 ${lv.badge}`}>{lv.label}（スコア {Number(a.gap_score)}）</span>
                  </button>
                </li>
              );
            })}
          </ul>
          )}
          </div>
        </div>
      </div>

      {tab === "compare" && (
        <section className="panel p-4 sm:p-6">
          <h2 className="font-bold mb-1">人口と医療機関数の対比</h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-ink-muted)" }}>
            人口規模に対して医療機関が少ないエリアほど、1機関への依存度が高くなります（出典: 東京都の人口（推計）・東京都保健医療局）
          </p>
          <div className="h-96">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--parchment-line)" />
                <XAxis dataKey="name" fontSize={11} interval={0} angle={-30} textAnchor="end" height={70} stroke="var(--text-ink-muted)" />
                <YAxis yAxisId="pop" fontSize={12} width={52} stroke="var(--text-ink-muted)" />
                <YAxis yAxisId="fac" orientation="right" fontSize={12} width={32} allowDecimals={false} stroke="var(--text-ink-muted)" />
                <Tooltip />
                <Legend />
                <Bar isAnimationActive={false} yAxisId="pop" dataKey="population" name="人口" fill="#2f7a68" />
                <Bar isAnimationActive={false} yAxisId="fac" dataKey="facility_count" name="医療機関数" fill="#b0842c" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {tab === "priority" && (
        <div className="space-y-4">
          {top && (
            <div className="panel p-4 text-sm border-l-4" style={{ borderLeftColor: "var(--danger)" }}>
              医療アクセスギャップが最も大きいのは
              <span className="font-bold">「{top.name}」</span>
              です。基幹病院まで直線 約{Math.round(Number(top.distance_to_hub_km))}km、
              救急告示医療機関 {Number(top.emergency_count)}か所。
              オンライン診療・オンライン処方の優先導入により、通院の負担を大きく減らせる可能性があります。
            </div>
          )}
          <section className="panel p-4 sm:p-6">
            <h2 className="font-bold mb-1">医療アクセスギャップ ランキング</h2>
            <p className="text-xs mb-4" style={{ color: "var(--text-ink-muted)" }}>
              スコア = 基幹病院（都立広尾病院）までの距離km × 救急補正（救急なし×1.5）× 医療機能補正（小児・妊婦対応なし 各×1.2、医療機関ゼロ×2）
            </p>
            <div className="h-96">
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--parchment-line)" />
                  <XAxis type="number" fontSize={12} stroke="var(--text-ink-muted)" />
                  <YAxis type="category" dataKey="name" fontSize={12} width={110} stroke="var(--text-ink-muted)" />
                  <Tooltip />
                  <Bar isAnimationActive={false} dataKey="gap_score" name="ギャップスコア">
                    {chartData.map((d) => (
                      <Cell key={d.name} fill={LEVELS[d.level].color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel p-4 sm:p-6">
            <h2 className="font-bold mb-1">オンライン診療 導入優先エリア提案</h2>
            <p className="text-xs mb-4" style={{ color: "var(--text-ink-muted)" }}>
              ギャップスコアの高い順。理由はオープンデータ（医療機関の届出情報・人口・距離）から自動生成しています
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left eyebrow hairline-b" style={{ color: "var(--text-ink-muted)" }}>
                    <th className="py-2 pr-3 font-normal">優先度</th>
                    <th className="py-2 pr-3 font-normal">エリア</th>
                    <th className="py-2 pr-3 font-normal">人口</th>
                    <th className="py-2 pr-3 font-normal">スコア</th>
                    <th className="py-2 font-normal">優先とする理由</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((a) => {
                    const lv = LEVELS[gapLevel(Number(a.gap_score))];
                    return (
                      <tr key={a.slug} className="hairline-b align-top">
                        <td className="py-2 pr-3 font-data font-bold" style={{ color: lv.color }}>
                          {Number(a.priority_rank)}位
                        </td>
                        <td className="py-2 pr-3">
                          <button
                            onClick={() => {
                              selectArea(a.slug);
                              selectTab("map");
                            }}
                            className="font-bold underline text-left"
                            style={{ color: "var(--accent)" }}
                          >
                            {a.name}
                          </button>
                          <div className="text-xs" style={{ color: "var(--text-ink-muted)" }}>{a.municipality}</div>
                        </td>
                        <td className="py-2 pr-3 font-data">{a.population.toLocaleString()}人</td>
                        <td className="py-2 pr-3">
                          <span className={`chip ${lv.badge}`}>
                            {Number(a.gap_score)}（{lv.label}）
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {gapReasons(a).map((r) => (
                              <span
                                key={r}
                                className="text-[11px] px-1.5 py-0.5"
                                style={{ background: "var(--parchment-deep)", color: "var(--text-ink)" }}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-ink-muted)" }}>
              エリア名をクリックすると地図タブに切り替わり、そのエリアの詳細が開きます
            </p>
          </section>
        </div>
      )}

      <p className="text-xs text-center" style={{ color: "var(--text-parchment-muted)" }}>
        ランキングやマップ上の島をクリックすると、右側が医療機関一覧・移動手段・距離定規に切り替わります
      </p>
    </div>
  );
}
