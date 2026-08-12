import { Client, Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  interface CloudflareEnv {
    // Cloudflare Hyperdrive経由のPostgres接続（wrangler.jsonc参照）
    HYPERDRIVE?: { connectionString: string };
  }
  var pgPool: Pool | undefined;
}

// 呼び出し側が使うのは query() だけ。ローカルはPool、WorkersはリクエストごとのClientで実装する
export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>>;
};

type CloudflareContext = {
  env: CloudflareEnv;
  ctx: { waitUntil(promise: Promise<unknown>): void };
};

async function getCloudflareEnv(): Promise<CloudflareContext | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    return context.env.HYPERDRIVE ? (context as CloudflareContext) : null;
  } catch {
    // ローカルのnext dev/next start等、Cloudflareコンテキストが存在しない場合
    return null;
  }
}

// Cloudflare Workersでは、あるリクエストで張ったソケットを別のリクエストから触れない
// （Cannot perform I/O on behalf of a different request）。接続を跨いで使い回すと
// isolateの2回目以降が例外になり1101を返すため、クエリごとにClientを張って閉じる。
// Hyperdrive側が接続をプールするので、接続コストはWorkers内では発生しない
function workersDb({ env, ctx }: CloudflareContext): Queryable {
  const connectionString = env.HYPERDRIVE!.connectionString;
  return {
    async query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[]
    ) {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        return (await client.query(text, values)) as QueryResult<T>;
      } finally {
        // レスポンスを待たせないよう、切断はリクエスト終了後に回す
        ctx.waitUntil(client.end().catch(() => {}));
      }
    },
  };
}

// ローカル（next dev / next start / Docker Postgres）はPoolを使い回す
function localDb(): Pool {
  if (global.pgPool) return global.pgPool;
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://ritou:ritou@localhost:5436/ritou",
    max: 5,
  });
  if (process.env.NODE_ENV !== "production") global.pgPool = pool;
  return pool;
}

export async function getDb(): Promise<Queryable> {
  const cf = await getCloudflareEnv();
  return cf ? workersDb(cf) : localDb();
}
