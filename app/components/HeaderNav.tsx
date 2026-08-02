"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { hash: "map", label: "地図＋ランキング" },
  { hash: "priority", label: "優先エリア提案" },
];

// トップページ上ではタブ切替、他ページからは通常のページ遷移として振る舞う。
// next/link は同一ページ内のハッシュ変更を pushState で処理し hashchange を発火しないため、
// トップページ上でだけ location.hash を直接書き換えて Workbench に伝える。
export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-5 text-sm">
      {ITEMS.map((item) => (
        <Link
          key={item.hash}
          href={`/#${item.hash}`}
          className="eyebrow hover:text-[var(--accent-bright)]"
          onClick={(e) => {
            if (pathname !== "/") return;
            e.preventDefault();
            window.location.hash = item.hash;
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
