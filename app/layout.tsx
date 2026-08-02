import type { Metadata } from "next";
import { Shippori_Mincho_B1, Zen_Kaku_Gothic_New, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import HeaderNav from "./components/HeaderNav";
import "./globals.css";

const shippori = Shippori_Mincho_B1({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-shippori",
  display: "swap",
});
const zen = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-zen",
  display: "swap",
});
const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono-data",
  display: "swap",
});

export const metadata: Metadata = {
  title: "島しょ・へき地医療アクセスマップ",
  description:
    "東京都の島しょ部・へき地の医療アクセスを可視化し、オンライン診療の優先導入エリアを提案する東京都オープンデータ活用マップ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`h-full antialiased ${shippori.variable} ${zen.variable} ${jbMono.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <header
          className="sticky top-0 z-40 border-b"
          style={{ borderColor: "var(--ink-line)", background: "var(--ink)" }}
        >
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
            <Link href="/" className="flex items-center gap-3">
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                <circle cx="15" cy="15" r="13" stroke="var(--accent-bright)" strokeWidth="1.4" />
                <circle cx="15" cy="15" r="1.6" fill="var(--accent-bright)" />
                <path d="M15 3 L15 8 M15 22 L15 27 M3 15 L8 15 M22 15 L27 15" stroke="var(--accent-bright)" strokeWidth="1.2" />
                <path d="M15 15 L20 8" stroke="var(--text-parchment)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="font-bold leading-tight">
                <span className="block text-[15px]" style={{ fontFamily: "var(--font-display)" }}>
                  島しょ・へき地医療アクセス海図
                </span>
                <span className="eyebrow block" style={{ color: "var(--text-parchment-muted)" }}>
                  ISLAND HEALTHCARE ACCESS CHART
                </span>
              </span>
            </Link>
            <HeaderNav />
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
        <footer
          className="text-center text-xs py-5 px-4 border-t"
          style={{ borderColor: "var(--ink-line)", color: "var(--text-parchment-muted)" }}
        >
          データ出典: 東京都オープンデータAPI（東京都総務局・東京都保健医療局）/ 地図: 国土地理院 / ジオコーディング: 国土地理院API
          <br />
          ※医療機関の対応状況は「診療・検査医療機関の一覧」「救急医療機関一覧」掲載時点の情報です。受診の際は各医療機関・自治体に最新情報をご確認ください
          <br />
          <Link href="/methodology" className="underline hover:text-[var(--accent-bright)]">
            スコアの算出方法とデータについて
          </Link>
        </footer>
      </body>
    </html>
  );
}
