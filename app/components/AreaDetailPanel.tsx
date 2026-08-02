import Link from "next/link";
import { LEVELS, gapLevel, type AreaGap, type Facility } from "@/lib/gap";
import DistanceRuler from "./DistanceRuler";
import FacilityTable from "./FacilityTable";

// 一覧から選んだエリアの詳細を、ページ遷移せずその場で開くパネル。
// 全施設・ミニマップまで見たい場合のみ /island/[slug] の詳細ページに誘導する。
export default function AreaDetailPanel({
  area,
  facilities,
  onClose,
}: {
  area: AreaGap;
  facilities: Facility[];
  onClose?: () => void;
}) {
  const lv = LEVELS[gapLevel(Number(area.gap_score))];
  const distKm = Number(area.distance_to_hub_km);
  const hasEmergency = Number(area.emergency_count) > 0;

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow" style={{ color: "var(--text-ink-muted)" }}>
            {area.kind === "island" ? "ISLAND" : "REMOTE AREA"} · 優先度 {Number(area.priority_rank)}位
          </p>
          <h3 className="text-lg font-bold">{area.name}</h3>
          <p className="text-xs" style={{ color: "var(--text-ink-muted)" }}>
            {area.municipality}（{area.subprefecture}）
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`chip ${lv.badge}`}>{lv.label}</span>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="w-6 h-6 flex items-center justify-center text-sm"
              style={{ color: "var(--text-ink-muted)" }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="p-2" style={{ background: "var(--parchment-deep)" }}>
          <div className="text-[10px]" style={{ color: "var(--text-ink-muted)" }}>人口</div>
          <div className="text-base font-bold font-data">{area.population.toLocaleString()}人</div>
        </div>
        <div className="p-2" style={{ background: "var(--parchment-deep)" }}>
          <div className="text-[10px]" style={{ color: "var(--text-ink-muted)" }}>医療機関</div>
          <div className="text-base font-bold font-data">
            {Number(area.facility_count)}か所
            <span className="text-[10px] font-normal"> (救急{Number(area.emergency_count)})</span>
          </div>
        </div>
        <div className="p-2" style={{ background: "var(--parchment-deep)" }}>
          <div className="text-[10px]" style={{ color: "var(--text-ink-muted)" }}>ギャップスコア</div>
          <div className="text-base font-bold font-data" style={{ color: lv.color }}>
            {Number(area.gap_score)}
          </div>
        </div>
        <div className="p-2" style={{ background: "var(--parchment-deep)" }}>
          <div className="text-[10px]" style={{ color: "var(--text-ink-muted)" }}>本土への交通</div>
          <div className="text-xs font-bold pt-1">{area.transport}</div>
        </div>
      </div>

      <div className="hairline-t pt-3">
        <DistanceRuler km={distKm} tone="light" color={lv.color} label="基幹病院（都立広尾病院）まで直線" />
      </div>
      {!hasEmergency && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          このエリアには救急告示医療機関がありません。
        </p>
      )}

      <div className="hairline-t pt-3 space-y-2">
        <h4 className="text-sm font-bold">医療機関一覧（{facilities.length}か所）</h4>
        <FacilityTable facilities={facilities} />
      </div>

      <div className="text-right">
        <Link
          href={`/island/${area.slug}`}
          className="text-sm font-bold underline"
          style={{ color: "var(--accent)" }}
        >
          ミニマップ・全情報を見る →
        </Link>
      </div>
    </div>
  );
}
