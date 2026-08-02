// 医療アクセスギャップ（孤立度）レベルの定義と型

export type Level = "critical" | "high" | "moderate" | "low";

export const LEVELS: Record<
  Level,
  { label: string; color: string; badge: string }
> = {
  critical: {
    label: "特に深刻",
    color: "#c1432b",
    badge: "chip-critical",
  },
  high: {
    label: "深刻",
    color: "#c97a3d",
    badge: "chip-high",
  },
  moderate: {
    label: "注意",
    color: "#b0842c",
    badge: "chip-moderate",
  },
  low: {
    label: "比較的良好",
    color: "#2f7a68",
    badge: "chip-low",
  },
};

export const LEGEND_ORDER: Level[] = ["critical", "high", "moderate", "low"];

// 閾値は area_gap の実スコア分布（59〜1470）から決定
export function gapLevel(score: number): Level {
  if (score >= 500) return "critical";
  if (score >= 250) return "high";
  if (score >= 150) return "moderate";
  return "low";
}

// area_gap ビューの1行（pgはnumeric/bigint列を文字列で返すため string | number）
export type AreaGap = {
  slug: string;
  name: string;
  municipality: string;
  area_code: string;
  subprefecture: string;
  kind: "island" | "hekichi";
  lat: number;
  lng: number;
  population: number;
  households: number | null;
  area_km2: string | number | null;
  density: string | number | null;
  transport: string;
  travel_note: string;
  distance_to_hub_km: string | number;
  facility_count: string | number;
  emergency_count: string | number;
  pediatric_count: string | number;
  maternity_count: string | number;
  pop_per_facility: string | number | null;
  gap_score: string | number;
  priority_rank: string | number;
};

export type Facility = {
  id: number;
  area_slug: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  is_emergency: boolean;
  pediatric: boolean;
  maternity: boolean;
  testing: boolean;
  open_hours: string;
  geocode_fallback: boolean;
  source: string;
};

// オンライン診療優先度の理由文を機械的に生成する
export function gapReasons(a: AreaGap): string[] {
  const reasons: string[] = [];
  const facilities = Number(a.facility_count);
  const emergency = Number(a.emergency_count);
  if (facilities === 0) reasons.push("医療機関ゼロ");
  else if (facilities === 1) reasons.push("医療機関が1か所のみ");
  if (emergency === 0) reasons.push("救急告示医療機関なし");
  if (Number(a.pediatric_count) === 0) reasons.push("小児対応なし");
  if (Number(a.maternity_count) === 0) reasons.push("妊婦対応なし");
  reasons.push(`基幹病院まで直線 約${Math.round(Number(a.distance_to_hub_km))}km`);
  return reasons;
}
