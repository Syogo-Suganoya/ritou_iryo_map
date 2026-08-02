import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // パスに日本語ディレクトリが含まれる環境でルート誤推定によるTurbopackの
  // パニックを避けるため、ワークスペースルートをこのアプリに固定する
  turbopack: {
    root: __dirname,
  },
  // pg/pg-cloudflareはworkerd向けのconditional exportsを持つため、
  // Next側でバンドルさせずランタイム解決に任せる（Cloudflareアダプタ向けの既知の対処）
  // https://opennext.js.org/cloudflare/howtos/workerd
  serverExternalPackages: ["pg", "pg-cloudflare"],
};

export default nextConfig;

// next devでもCloudflareのbindings（Hyperdrive等）をローカルで使えるようにする
// https://opennext.js.org/cloudflare/get-started
initOpenNextCloudflareForDev();
