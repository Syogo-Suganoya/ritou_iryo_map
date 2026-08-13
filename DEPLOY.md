# デプロイ手順書 — Neon + Cloudflare Workers

このアプリを本番公開するための手順。構成は以下の通り。

| 役割 | サービス | 費用 |
| :--- | :--- | :--- |
| アプリ本体 (Next.js SSR + API) | Cloudflare Workers（`@opennextjs/cloudflare` アダプタ） | 無料枠内（1日10万リクエストまで無料） |
| DB (PostgreSQL) | Neon 無料枠 | 無料（ストレージ0.5GB） |
| DBへの接続 | Cloudflare Hyperdrive | 無料枠内 |

> **なぜHyperdriveが要るのか**: Cloudflare WorkersはNode.jsの`net`によるTCP接続を直接張れないため、
> `pg`（node-postgres）はそのままでは動かない。**Hyperdrive** がWorkers–Postgres間の接続を
> プロキシ・プーリングしてくれるため、アプリ側のクエリ発行部分（`db.query(...)`）は変更不要。
> ローカル開発（`npm run dev` / Docker Postgres）にも影響しない。

> **前提**: Cloudflareのアカウントは付与済みとする。未ログインの場合のみ `npx wrangler login` を実行し、
> ブラウザで開く認可画面で、付与されたアカウントを選んで許可する。

このリポジトリには既に以下が設定済み：
- `@opennextjs/cloudflare` / `wrangler`（devDependencies）、`pg-cloudflare`（dependencies）
- [`wrangler.jsonc`](wrangler.jsonc)（Workerの設定。`account_id` 設定済み、`hyperdrive` バインディングはプレースホルダ入り）
- [`open-next.config.ts`](open-next.config.ts)（Cloudflareアダプタの設定）
- [`next.config.ts`](next.config.ts)（`serverExternalPackages` と `initOpenNextCloudflareForDev`）
- [`lib/db.ts`](lib/db.ts)（Workers上では`env.HYPERDRIVE`、ローカルでは`DATABASE_URL`を自動で使い分ける`getDb()`）
- `package.json` の `cf:preview` / `cf:deploy` スクリプト

そのため、以下は手順1から進めればよい。

---

## 手順1: Neon でDBを作る（約5分）

1. https://neon.tech を開き、**Sign up**（Googleアカウント可）
2. プロジェクト作成画面で以下を入力して **Create project**
   - Project name: `ritou-iryo-map`（任意）
   - Postgres version: そのまま（16以上）
   - Region: **Asia Pacific (Singapore)** など、いちばん近いリージョン
3. 作成直後のダッシュボードに **Connection string** が表示される。
   **「Pooled connection」のチェックを外した**、直接接続の文字列をコピーする
   （`postgresql://ユーザー名:パスワード@ep-xxxx.ap-xxxx.aws.neon.tech/neondb?sslmode=require` の形式。
   Hyperdrive自身がコネクションプーリングを行うため、Neon側のPoolerは経由しない方が安定する）

## 手順2: スキーマとシードデータを投入（約3分）

1. Neon のダッシュボード左メニューから **SQL Editor** を開く
2. [`db/init/01_schema.sql`](db/init/01_schema.sql) の中身を全部コピーして貼り付け、**Run**
3. 続けて [`db/init/02_seed.sql`](db/init/02_seed.sql) の中身を貼り付けて **Run**
4. 左メニュー **Tables** で `areas`（11行）と `facilities`（16行）ができていれば成功
   （`area_gap` はビューなので **Views** に表示される）

## 手順3: Hyperdrive を作成する（約5分）

Neonの接続文字列をCloudflareに登録し、Hyperdriveの設定を作る。

```bash
npx wrangler hyperdrive create ritou-iryo-map \
  --connection-string="postgresql://ユーザー名:パスワード@ep-xxxx.ap-xxxx.aws.neon.tech/neondb?sslmode=require"
```

実行すると `id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"` が出力される。この値を
`wrangler.jsonc` の `hyperdrive[0].id` の `<HYPERDRIVE_ID>` と置き換える。

> GUIで作る場合は Cloudflareダッシュボード → **Storage & Databases > Hyperdrive** →
> **Create configuration** から、同じ接続文字列を登録しても同じIDが得られる。

## 手順4: ローカルでビルド・動作確認（約5分）

デプロイ前に、Cloudflare Workers環境を模したローカルプレビューで確認する。

```bash
# Docker PostgreSQLがまだならDBを起動
docker compose up -d

# Cloudflare向けにビルドしてプレビュー
npm run cf:preview
```

開いたURL（デフォルト `http://localhost:8788` 付近）で、トップページの収録件数
（11エリア / 医療機関16か所）が出ればHyperdrive経由のDB接続もOK。

## 手順5: デプロイ

```bash
npm run cf:deploy
```

完了すると `https://ritou-iryo-map.<あなたのサブドメイン>.workers.dev` のURLが発行される。

動作確認チェックリスト:
- [ ] `/` — ヒーローの収録件数が表示される（←DB接続の確認）
- [ ] `/#map` — 地図に島バブルが表示され、島やランキング項目をクリックすると詳細パネルが開く
- [ ] `/#compare` / `/#priority` — チャートと優先エリア提案テーブルが表示される
- [ ] `/island/ogasawara` — 島別詳細ページと島内ミニマップが表示される
- [ ] `/methodology` — スコアの算出方法ページが表示される

---

## 手順6: GitHub Actions で自動デプロイ（CD）を有効にする（約10分）

手順5の手動デプロイが通ったら、`main` への push で自動デプロイされるようにする。
ワークフローは [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) にコミット済み。

| トリガー | 実行内容 |
| :--- | :--- |
| Pull Request（→ main） | `check` ジョブのみ（`npm run lint` → `npx tsc --noEmit` → `npm run build`） |
| `main` への push | `check` の後に `deploy`（`npm run cf:deploy`） |
| 手動（Actions画面の Run workflow） | 同上 |

`check` はDBに接続しない（`/` は `force-dynamic`、`/island/[slug]` は動的ルートのため
ビルド時にプリレンダされない）ので、CI側にDBを用意する必要はない。

### 6-1. Cloudflare APIトークンを発行する（カスタムトークン）

テンプレート（「Edit Cloudflare Workers」）は使わず、**Create Custom Token** で
このアプリのデプロイに必要な権限だけを持つトークンを作る。

1. Cloudflareダッシュボード右上のアイコン → **My Profile** → **API Tokens** → **Create Token**
2. 一番下の **Create Custom Token** の **Get started** を押す
3. **Token name**: `ritou-iryo-map-deploy`（任意）
4. **Permissions** に以下の3行を追加する

   | 種別 | 項目 | 権限 | 用途 |
   | :--- | :--- | :--- | :--- |
   | Account | Workers Scripts | Edit | Workerスクリプトと静的アセットのアップロード（必須） |
   | Account | Hyperdrive | Read | `wrangler.jsonc` の Hyperdrive バインディングの検証 |
   | Account | Account Settings | Read | wrangler がアカウント情報を解決するため |

   > このリポジトリの [`open-next.config.ts`](open-next.config.ts) は
   > `defineCloudflareConfig()` の最小構成で、キャッシュ用の KV / R2 / D1 を使っていない。
   > そのため Workers KV Storage や R2 の権限は不要。
   > 将来キャッシュバックエンドを足したら、対応する権限（KV Storage: Edit など）を追加する。

5. **Account Resources**: `Include` → 対象アカウント（`a128e75b7210f99f780cccff2c2cf5ab`）を選ぶ
6. **Zone Resources**: 設定不要（`workers.dev` で公開するため。独自ドメインに載せる場合のみ、
   別途 Zone → Workers Routes → Edit を追加する）
7. **Client IP Address Filtering** / **TTL**: GitHub Actions のIPは固定できないためIP制限は付けない。
   TTLは運用に合わせて任意（無期限でも可）
8. **Continue to summary** → **Create Token**
9. 表示されたトークン文字列をコピーする（**この画面を閉じると二度と表示されない**）

### 6-2. GitHub側に登録する

リポジトリの **Settings → Secrets and variables → Actions** で登録する。

| 種別 | 名前 | 値 |
| :--- | :--- | :--- |
| Secret | `CLOUDFLARE_API_TOKEN` | 6-1で発行したトークン |

`deploy` ジョブは `environment: production` を指定しているので、GitHubの
**Settings → Environments** で `production` を作り、Required reviewers を付ければ
デプロイ前に承認を挟むこともできる（任意）。

### 6-3. 動作確認

`main` に push し、**Actions** タブで `check` → `deploy` が緑になることを確認する。
完了後、手順5の動作確認チェックリストを本番URLで再確認する。

---

## トラブルシューティング

| 症状 | 対処 |
| :--- | :--- |
| `cf:preview` / `cf:deploy` で `Could not resolve "pg-cloudflare"` | `pg-cloudflare` が依存関係に入っているか確認。`next.config.ts` の `serverExternalPackages: ["pg", "pg-cloudflare"]` が外れていないか確認 |
| トップの収録件数が出ない／APIが500 | Hyperdriveの`id`が`wrangler.jsonc`に正しく設定されているか確認。Neonの接続文字列がプールなし（直接接続）になっているか確認 |
| 本番が数回に1回 `Error 1101 Worker threw exception` になる | DB接続をリクエストを跨いで使い回すと、Workersが `Cannot perform I/O on behalf of a different request` で例外を出す（ログ上は「code had hung」として現れることもある）。[`lib/db.ts`](lib/db.ts) がクエリごとに `Client` を張って `ctx.waitUntil` で閉じる実装になっているか確認する。`Pool` をモジュールスコープに保持する実装に戻すと再発する |
| ローカルの`wrangler dev`だけDB接続できない | `docker compose up -d` でPostgreSQLが起動しているか確認。`wrangler.jsonc`の`localConnectionString`のポート（**5436**）が`docker-compose.yml`と一致しているか確認 |
| Actionsのdeployが `Authentication error [code: 10000]` | `CLOUDFLARE_API_TOKEN` が未設定、または権限不足。手順6-1の3つの権限（Workers Scripts: Edit / Hyperdrive: Read / Account Settings: Read）と、Account Resources に対象アカウントが含まれているかを確認する |
| 地図タイルが出ない | 国土地理院タイル（`cyberjapandata.gsi.go.jp`）と島名グリフ（`glyphs.geolonia.com`）への外部通信。`compatibility_flags` に `global_fetch_strictly_public` が入っているか確認 |

## デプロイ後のデータ更新

1. ローカルで `npm run ingest` を実行し `db/init/02_seed.sql` を再生成
2. Neon の SQL Editor で `TRUNCATE facilities; TRUNCATE areas CASCADE;` を実行
3. 再生成した `02_seed.sql` を貼り付けて **Run**

アプリ側の再デプロイは不要（DBを読むだけのため）。

## 費用の目安

- **Neon**: 無料枠（0.5GB / 自動サスペンドあり）で十分。カード登録不要
- **Cloudflare Workers**: 無料枠（1日10万リクエストまで）で十分
- **Hyperdrive**: 無料枠内（このアプリの規模なら通常は0円）
- 東京都オープンデータAPIへのアクセスは取り込み時のみ。本番アプリから出る外部通信は
  国土地理院タイルと島名グリフだけで、APIキーの設定は一切不要
