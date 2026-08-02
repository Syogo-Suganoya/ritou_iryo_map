import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { LEVELS, gapLevel, type AreaGap, type Facility } from "@/lib/gap";
import IslandMiniMap from "./IslandMiniMap";
import DistanceRuler from "../../components/DistanceRuler";

export const metadata = { title: "島別詳細 | 島しょ・へき地医療アクセスマップ" };

export default async function IslandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[a-z]+$/.test(slug)) notFound();

  const db = await getDb();
  const { rows } = await db.query<AreaGap>(
    `SELECT * FROM area_gap WHERE slug = $1`,
    [slug]
  );
  const area = rows[0];
  if (!area) notFound();

  const { rows: facilities } = await db.query<Facility>(
    `SELECT * FROM facilities WHERE area_slug = $1 ORDER BY is_emergency DESC, name`,
    [slug]
  );

  const lv = LEVELS[gapLevel(Number(area.gap_score))];
  const distKm = Number(area.distance_to_hub_km);
  const hasEmergency = Number(area.emergency_count) > 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/#map" className="text-sm underline" style={{ color: "var(--accent-bright)" }}>
          ← 地図に戻る
        </Link>
      </div>

      {/* ヘッダー */}
      <div className="panel p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="eyebrow" style={{ color: "var(--text-ink-muted)" }}>
              {area.kind === "island" ? "ISLAND" : "REMOTE AREA"}
            </p>
            <h1 className="text-2xl font-bold">{area.name}</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-ink-muted)" }}>
              {area.municipality}（{area.subprefecture}）
            </p>
          </div>
          <span className={`chip ${lv.badge}`}>医療アクセスギャップ: {lv.label}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3" style={{ background: "var(--parchment-deep)" }}>
            <div className="text-xs" style={{ color: "var(--text-ink-muted)" }}>人口</div>
            <div className="text-xl font-bold font-data">{area.population.toLocaleString()} 人</div>
          </div>
          <div className="p-3" style={{ background: "var(--parchment-deep)" }}>
            <div className="text-xs" style={{ color: "var(--text-ink-muted)" }}>世帯数</div>
            <div className="text-xl font-bold font-data">
              {area.households ? Number(area.households).toLocaleString() : "—"} 世帯
            </div>
          </div>
          <div className="p-3" style={{ background: "var(--parchment-deep)" }}>
            <div className="text-xs" style={{ color: "var(--text-ink-muted)" }}>面積</div>
            <div className="text-xl font-bold font-data">
              {area.area_km2 ? Number(area.area_km2).toLocaleString() : "—"} km²
            </div>
          </div>
          <div className="p-3" style={{ background: "var(--parchment-deep)" }}>
            <div className="text-xs" style={{ color: "var(--text-ink-muted)" }}>医療機関</div>
            <div className="text-xl font-bold font-data">
              {Number(area.facility_count)} か所
              <span className="text-sm font-normal" style={{ color: "var(--text-ink-muted)" }}>
                （救急 {Number(area.emergency_count)}）
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* スコア＋交通手段 */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="panel p-6 space-y-3">
          <h2 className="font-bold">オンライン診療導入 優先度</h2>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-extrabold font-data" style={{ color: lv.color }}>
              {Number(area.priority_rank)}位
            </span>
            <span className="text-sm" style={{ color: "var(--text-ink-muted)" }}>/ 11エリア中（スコア {Number(area.gap_score)}）</span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-ink-muted)" }}>
            スコア = 基幹病院（都立広尾病院）までの距離 × 救急補正 × 医療機能補正。
            {!hasEmergency && "このエリアには救急告示医療機関がありません。"}
          </p>
        </div>
        <div className="panel p-6 space-y-3">
          <h2 className="font-bold">本土への移動手段</h2>
          <p className="text-sm">{area.transport}</p>
          {area.travel_note && <p className="text-xs" style={{ color: "var(--text-ink-muted)" }}>{area.travel_note}</p>}
          <div className="hairline-t pt-3">
            <DistanceRuler km={distKm} tone="light" color={lv.color} label="基幹病院（都立広尾病院）まで直線" />
          </div>
          {area.kind === "island" && (
            <p className="text-xs" style={{ color: "var(--text-ink-muted)" }}>
              急患時はヘリコプター等による東京消防庁・自衛隊の救急搬送体制があります
            </p>
          )}
        </div>
      </div>

      {/* 医療機関一覧 */}
      <div className="panel p-6 space-y-4">
        <h2 className="font-bold">医療機関一覧（{facilities.length}か所）</h2>
        {facilities.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left eyebrow hairline-b" style={{ color: "var(--text-ink-muted)" }}>
                  <th className="py-2 pr-3 font-normal">名称</th>
                  <th className="py-2 pr-3 font-normal">対応</th>
                  <th className="py-2 pr-3 font-normal">診療曜日</th>
                  <th className="py-2 font-normal">電話</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((f) => (
                  <tr key={f.id} className="hairline-b align-top">
                    <td className="py-2 pr-3">
                      <div className="font-bold">
                        {f.is_emergency && (
                          <span className="chip chip-critical mr-1.5 align-middle">救急</span>
                        )}
                        {f.name}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-ink-muted)" }}>{f.address}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {f.pediatric && (
                          <span className="text-[10px] px-1.5 py-0.5" style={{ background: "var(--parchment-deep)", color: "var(--text-ink)" }}>小児</span>
                        )}
                        {f.maternity && (
                          <span className="text-[10px] px-1.5 py-0.5" style={{ background: "var(--parchment-deep)", color: "var(--text-ink)" }}>妊婦</span>
                        )}
                        {f.testing && (
                          <span className="text-[10px] px-1.5 py-0.5" style={{ background: "var(--parchment-deep)", color: "var(--text-ink)" }}>検査</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-xs" style={{ color: "var(--text-ink-muted)" }}>
                      {f.open_hours.replace("診療曜日: ", "") || "—"}
                    </td>
                    <td className="py-2 text-xs font-data">{f.phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            オープンデータに登録された医療機関がありません。
          </p>
        )}
        <IslandMiniMap center={{ lat: area.lat, lng: area.lng }} facilities={facilities} />
        <p className="text-xs" style={{ color: "var(--text-ink-muted)" }}>
          出典: 救急医療機関一覧・診療・検査医療機関の一覧（東京都保健医療局）。「対応」は掲載時点の届出情報にもとづくもので、最新の診療体制は各医療機関にご確認ください
        </p>
      </div>

      <div className="text-center">
        <Link href="/#priority" className="btn btn-outline-ink inline-flex">
          優先エリア提案で全エリアを比較する
        </Link>
      </div>
    </div>
  );
}
