# 開発者向けガイド

## 構成

- Next.js (App Router) + TypeScript + Tailwind CSS
- 地図: MapLibre GL JS + 国土地理院タイル（APIキー不要）。ギャップレベルの色分けは `circle-color` のデータ駆動スタイリング、島バブルの半径は `sqrt(人口)` スケール。島名ラベルは symbol レイヤー（グリフ: glyphs.geolonia.com）
- グラフ: Recharts（`isAnimationActive={false}` — スクリーンショット取得時にアニメ初期状態が写るのを防ぐため）
- DB: PostgreSQL 16（Docker、ポート**5436**・DB名 `ritou`。14系と同時起動できるようポートをずらしている）。ギャップスコアは `area_gap` ビューでSQL算出
- データ: 東京都オープンデータAPI（`service.api.metro.tokyo.lg.jp`）から取り込み
  - 東京都の人口（推計）: 島しょ9町村＋檜原村・奥多摩町の人口・世帯・面積・人口密度
  - 救急医療機関一覧: 対象エリアの救急告示医療機関（大島医療センター・町立八丈病院・奥多摩病院の3件）
  - 診療・検査医療機関の一覧: 全4,948件を offset ページングで取得し、対象11自治体分を抽出
  - 座標はどのAPIにもないため国土地理院APIでジオコーディング（結果は `scripts/.geocache.json` にキャッシュ）

## ディレクトリ

| パス | 内容 |
| :--- | :--- |
| `app/` | 画面とAPIルート（`/` が地図・ランキング・比較チャートを含む単一ワークブック、`/island/[slug]` は詳細の共有用フルページ） |
| `app/components/Workbench.tsx` | `/` のクライアント本体。タブ切替（地図/人口対比/優先エリア）・地図・詳細パネルをまとめて持つ |
| `app/components/AreaDetailPanel.tsx` | 地図タブでエリアを選択したときにその場で開く詳細パネル（`/island/[slug]` と共通のFacilityTableを使用） |
| `lib/` | DB接続（`db.ts` の `getDb()`。ローカルは`DATABASE_URL`、Cloudflare Workers上はHyperdriveを自動判別）・ギャップレベル定義と理由文生成（`gap.ts`）・距離計算（`geo.ts`） |
| `wrangler.jsonc` / `open-next.config.ts` | Cloudflare Workers へのデプロイ設定（[DEPLOY.md](DEPLOY.md) 参照） |
| `db/init/` | スキーマ+ビュー（手書き）とシード（`ingest` で自動生成） |
| `scripts/ingest.mjs` | オープンデータ取り込みスクリプト（島マスタの静的定義もここ） |
| `scripts/architecture.py` | READMEのアーキテクチャ図（`docs/*.png`）の生成スクリプト |
| `.github/workflows/deploy.yml` | CI（lint/型/ビルド）と main への push で走るCD |

## データの再取得

```bash
npm run ingest                        # APIから再取得して db/init/02_seed.sql を再生成
docker compose down -v && docker compose up -d   # DB再作成
```

ingest実行時に自治体×ソース別の件数サマリが表示されるので、**全11自治体の人口が入ること・
大島/八丈/奥多摩に救急施設が付くこと・医療機関0件の島がないこと**を目視確認する。

取り込み対象のAPI IDは `scripts/ingest.mjs` の `POPULATION_API` / `EMERGENCY_API` / `CLINIC_API` に定義。
新しいAPIを追加するときは、[東京都オープンデータAPIカタログ](https://spec.api.metro.tokyo.lg.jp/spec/search)で検索し、
**必ず実呼び出しで生存確認してから**追加する（カタログには廃止済みAPIが混ざっている）。

### 取り込み時の注意（今回ハマった点）

- **自治体名の表記ゆれ**: 救急APIの西多摩は「区市町村=西多摩郡」、診療・検査APIは「西多摩郡奥多摩町」表記。
  さらに診療・検査APIの郡部の行政コードは不正確（奥多摩町・檜原村とも `13221`）。
  `findArea()` で「行政コード先頭5桁 → 区市町村名の包含 → 住所の包含」の順にフォールバックしている
- **名寄せ**: 「国民健康保険 町立八丈病院」（救急API）と「町立八丈病院」（診療・検査API）のような
  重複は、法人格・国保表記・空白を除いた正規化名＋自治体で突合してマージ
- **ジオコーディングの誤判定対策**: 取得座標が島の中心から30km超離れていたら誤判定とみなし、
  島の中心座標＋`geocode_fallback=true` にフォールバック（島の医療機関は貴重なので除外しない）

## Lint / 型チェック

```bash
npm run lint
npx tsc --noEmit
```

## 起動

```bash
docker compose up -d   # DB起動（db/init/ のスキーマ+シードが自動投入される。ポート5436）
npm install
npm run dev            # http://localhost:3000
```
