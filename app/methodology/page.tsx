import Link from "next/link";

export const metadata = { title: "スコアの算出方法とデータについて | 島しょ・へき地医療アクセス海図" };

export default function MethodologyPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/#map" className="text-sm underline" style={{ color: "var(--accent-bright)" }}>
          ← 地図に戻る
        </Link>
      </div>

      <div>
        <p className="eyebrow" style={{ color: "var(--accent-bright)" }}>
          METHODOLOGY
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold">スコアの算出方法とデータについて</h1>
      </div>

      <div className="panel p-6">
        <ul className="text-sm list-disc pl-5 space-y-2" style={{ color: "var(--text-ink-muted)" }}>
          <li>
            人口・面積: 東京都総務局「東京都の人口（推計）」（東京都オープンデータAPI）
          </li>
          <li>
            医療機関: 東京都保健医療局「救急医療機関一覧」「診療・検査医療機関の一覧」（東京都オープンデータAPI）。
            後者は発熱外来の届出情報のため、小児・妊婦・検査の対応状況は掲載時点のものです
          </li>
          <li>
            ギャップスコア = 基幹病院（都立広尾病院）までの直線距離 ×
            救急補正（救急告示医療機関なし ×1.5）× 医療機能補正（小児・妊婦対応なし 各×1.2、医療機関ゼロ ×2）
          </li>
          <li>
            本土への移動手段は各町村の一般的な交通情報（船・飛行機・ヘリコミューター等）を参考情報として掲載しています
          </li>
          <li>
            医療機関の座標は国土地理院ジオコーディングAPIで住所から変換。一部、住所解決できない施設は島の中心座標で表示しています
          </li>
        </ul>
      </div>
    </div>
  );
}
