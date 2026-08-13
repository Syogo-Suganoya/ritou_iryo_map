import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // opennextjs-cloudflare のビルド成果物（cf:preview / cf:deploy が生成する）
    ".open-next/**",
    ".wrangler/**",
    // 個人メモ用の作業ディレクトリ（gitignore済み）
    "_memo/**",
  ]),
]);

export default eslintConfig;
