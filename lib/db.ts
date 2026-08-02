import { Pool } from "pg";

declare global {
  interface CloudflareEnv {
    // Cloudflare Hyperdrive経由のPostgres接続（wrangler.jsonc参照）
    HYPERDRIVE?: { connectionString: string };
  }
  var pgPool: Pool | undefined;
}

let poolPromise: Promise<Pool> | undefined;

async function createPool(): Promise<Pool> {
  let connectionString =
    process.env.DATABASE_URL ?? "postgres://ritou:ritou@localhost:5436/ritou";

  try {
    // Cloudflare Workers上で実行されている場合はHyperdriveの接続文字列を使う
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    if (env.HYPERDRIVE) connectionString = env.HYPERDRIVE.connectionString;
  } catch {
    // ローカルのnext dev/next start等、Cloudflareコンテキストが存在しない場合は無視
  }

  return new Pool({ connectionString, max: 5 });
}

export function getDb(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = global.pgPool
      ? Promise.resolve(global.pgPool)
      : createPool().then((pool) => {
          if (process.env.NODE_ENV !== "production") global.pgPool = pool;
          return pool;
        });
  }
  return poolPromise;
}
