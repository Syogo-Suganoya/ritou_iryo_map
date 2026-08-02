import { getDb } from "@/lib/db";
import Workbench from "./components/Workbench";

export const dynamic = "force-dynamic";

async function getCounts() {
  try {
    const db = await getDb();
    const { rows } = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM areas)                              AS areas,
         (SELECT COUNT(*) FROM areas WHERE kind = 'island')        AS islands,
         (SELECT COUNT(*) FROM facilities)                         AS facilities,
         (SELECT COUNT(*) FROM facilities WHERE is_emergency)      AS emergencies,
         (SELECT SUM(population) FROM areas)                       AS population`
    );
    return rows[0] as {
      areas: string;
      islands: string;
      facilities: string;
      emergencies: string;
      population: string;
    };
  } catch {
    return null;
  }
}

export default async function Home() {
  const counts = await getCounts();

  return (
    <div className="space-y-8">
      {/* ヒーロー：海図の1ページ目という体裁 */}
      <section className="relative -mx-4 px-4 pt-10 pb-8 chart-grid border-b" style={{ borderColor: "var(--ink-line)" }}>
        <div className="max-w-3xl">
          <p className="eyebrow mb-3" style={{ color: "var(--accent-bright)" }}>
            CHART No.11 — 東京都島しょ・へき地医療圏
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-snug">
            船で24時間かかる医療圏を、
            <br />
            <span style={{ color: "var(--accent-bright)" }}>一枚の海図に。</span>
          </h1>
          <p className="mt-5 max-w-2xl" style={{ color: "var(--text-parchment-muted)" }}>
            東京都には伊豆諸島・小笠原諸島という「船で24時間」の医療圏があります。
            地図・ランキング・エリア詳細はすべてこの1画面にまとまっています。
            島やエリア名をクリックすると、その場で医療機関一覧や本土までの距離が開きます。
          </p>
          {counts && (
            <p className="font-data text-xs mt-6" style={{ color: "var(--text-parchment-muted)" }}>
              収録 {counts.areas}エリア（島しょ{counts.islands}町村＋西多摩へき地） / 医療機関{" "}
              {counts.facilities}か所（救急{counts.emergencies}） / 対象人口{" "}
              {Number(counts.population).toLocaleString()}人 — すべて東京都オープンデータAPI由来
            </p>
          )}
        </div>
      </section>

      <Workbench />
    </div>
  );
}
