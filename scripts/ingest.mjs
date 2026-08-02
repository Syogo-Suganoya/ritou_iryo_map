// 東京都オープンデータAPIから島しょ・へき地の人口と医療機関を取得し、db/init/02_seed.sql を生成する
// 使い方: npm run ingest → docker compose down -v && docker compose up -d で再投入
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = "https://service.api.metro.tokyo.lg.jp/api";
const GEOCACHE_PATH = join(ROOT, "scripts", ".geocache.json");

// ---------- 東京都オープンデータAPI ----------
async function fetchPage(apiId, limit, offset) {
  const res = await fetch(`${BASE}/${apiId}/json?limit=${limit}&offset=${offset}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Tokyo API ${apiId} responded ${res.status}`);
  return res.json();
}

async function fetchAll(apiId) {
  const first = await fetchPage(apiId, 1000, 0);
  const total = first.total ?? 0;
  const hits = [...(first.hits ?? [])];
  while (hits.length < total) {
    const page = await fetchPage(apiId, 1000, hits.length);
    const got = page.hits ?? [];
    if (got.length === 0) break; // ページング非対応なら打ち切り
    hits.push(...got);
  }
  return hits;
}

// ---------- 国土地理院ジオコーディング（結果はファイルにキャッシュ） ----------
const geocache = existsSync(GEOCACHE_PATH)
  ? JSON.parse(readFileSync(GEOCACHE_PATH, "utf8"))
  : {};

async function geocode(address) {
  if (!address) return null;
  if (address in geocache) return geocache[address];
  const res = await fetch(
    `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const candidates = await res.json();
  const coords = candidates?.[0]?.geometry?.coordinates;
  const v = coords ? { lat: coords[1], lng: coords[0] } : null;
  geocache[address] = v;
  await new Promise((r) => setTimeout(r, 150)); // 公共APIへの連続アクセスを抑制
  return v;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- 対象エリア（島しょ9町村＋西多摩へき地2町村） ----------
// lat/lng は役場付近、transport は本土への主な移動手段（オープンデータには存在しないため静的定義）
const HUB = { name: "都立広尾病院", lat: 35.6507, lng: 139.7176 }; // 島しょ医療の基幹病院

const AREAS = [
  { slug: "oshima",     name: "大島",     municipality: "大島町",   code: "13361", subprefecture: "大島支庁",   kind: "island",  lat: 34.7503, lng: 139.3556, transport: "大型客船・高速ジェット船（竹芝）／飛行機（調布）", travel_note: "ジェット船 約1時間45分／飛行機 約25分" },
  { slug: "toshima",    name: "利島",     municipality: "利島村",   code: "13362", subprefecture: "大島支庁",   kind: "island",  lat: 34.5265, lng: 139.2815, transport: "大型客船・高速ジェット船（竹芝）／ヘリコミューター（大島経由）", travel_note: "ジェット船 約2時間20分・海況による欠航あり" },
  { slug: "niijima",    name: "新島・式根島", municipality: "新島村", code: "13363", subprefecture: "大島支庁", kind: "island",  lat: 34.3763, lng: 139.2591, transport: "大型客船・高速ジェット船（竹芝）／飛行機（調布）", travel_note: "ジェット船 約2時間20分／飛行機 約40分" },
  { slug: "kouzushima", name: "神津島",   municipality: "神津島村", code: "13364", subprefecture: "大島支庁",   kind: "island",  lat: 34.2054, lng: 139.1340, transport: "大型客船・高速ジェット船（竹芝）／飛行機（調布）", travel_note: "ジェット船 約3時間5分／飛行機 約45分" },
  { slug: "miyake",     name: "三宅島",   municipality: "三宅村",   code: "13381", subprefecture: "三宅支庁",   kind: "island",  lat: 34.0736, lng: 139.4780, transport: "大型客船（竹芝・夜行）／飛行機（調布）", travel_note: "大型客船 約6時間30分／飛行機 約50分" },
  { slug: "mikurajima", name: "御蔵島",   municipality: "御蔵島村", code: "13382", subprefecture: "三宅支庁",   kind: "island",  lat: 33.8940, lng: 139.6010, transport: "大型客船（竹芝）／ヘリコミューター（三宅島経由）", travel_note: "大型客船 約7時間25分・接岸率が低く欠航が多い" },
  { slug: "hachijo",    name: "八丈島",   municipality: "八丈町",   code: "13401", subprefecture: "八丈支庁",   kind: "island",  lat: 33.1090, lng: 139.7896, transport: "飛行機（羽田・1日3便）／大型客船（竹芝）", travel_note: "飛行機 約55分／大型客船 約10時間20分" },
  { slug: "aogashima",  name: "青ヶ島",   municipality: "青ヶ島村", code: "13402", subprefecture: "八丈支庁",   kind: "island",  lat: 32.4577, lng: 139.7626, transport: "ヘリコミューター（八丈島・1日1便9席）／連絡船あおがしま丸（八丈島）", travel_note: "ヘリ 約20分／船 約3時間・就航率5〜6割" },
  { slug: "ogasawara",  name: "小笠原（父島・母島）", municipality: "小笠原村", code: "13421", subprefecture: "小笠原支庁", kind: "island", lat: 27.0940, lng: 142.1918, transport: "おがさわら丸（竹芝・約6日に1便）※空路なし", travel_note: "片道 約24時間。急患は自衛隊機・ヘリで搬送" },
  { slug: "hinohara",   name: "檜原村",   municipality: "檜原村",   code: "13307", subprefecture: "西多摩",     kind: "hekichi", lat: 35.7270, lng: 139.1490, transport: "路線バス（JR武蔵五日市駅から）／車", travel_note: "鉄道駅なし。バス 約25〜60分" },
  { slug: "okutama",    name: "奥多摩町", municipality: "奥多摩町", code: "13308", subprefecture: "西多摩",     kind: "hekichi", lat: 35.8090, lng: 139.0960, transport: "JR青梅線（奥多摩駅）／車", travel_note: "新宿から電車 約2時間" },
];

const byCode = new Map(AREAS.map((a) => [a.code, a]));

// 区市町村・住所の表記ゆれに対応したエリア特定
// （救急APIは「西多摩郡」、診療・検査APIは「西多摩郡奥多摩町」表記。郡部の行政コードも不正確）
function findArea({ code, municipality, address }) {
  const c5 = (code ?? "").slice(0, 5);
  if (byCode.has(c5)) return byCode.get(c5);
  for (const a of AREAS) {
    if (municipality?.includes(a.municipality)) return a;
  }
  for (const a of AREAS) {
    if (address?.includes(a.municipality)) return a;
  }
  return null;
}

// ---------- API ID ----------
const POPULATION_API = "t000003d2000001071-2f426fdbb32719c7530fa29ffee71129-0"; // 東京都の人口（推計）
const EMERGENCY_API = "t000055d0000000356-ca6cc0d345b4afab5569dca8d7fb47e0-0"; // 救急医療機関一覧
const CLINIC_API = "t000055d0000000391-c5bbc28a5a7899eca7b4ec57c3ba03be-0"; // 診療・検査医療機関の一覧

// ---------- 共通ヘルパー ----------
const s = (v) => (v == null ? "" : String(v).trim());
const num = (v) => {
  const n = Number(String(v ?? "").replaceAll(",", "").trim());
  return Number.isFinite(n) ? n : null;
};
const flag = (v) => s(v) === "1";
// キー表記ゆれ（注記付き列名など）に備えて前方一致でも探す
const pick = (h, prefix) => {
  if (prefix in h) return h[prefix];
  const key = Object.keys(h).find((k) => k.startsWith(prefix));
  return key ? h[key] : null;
};
// 名寄せ用: 空白・法人格・国保表記を除いた正規化名
const normName = (name) =>
  s(name)
    .replaceAll(/[\s　]/g, "")
    .replace(/^(医療法人社団|医療法人財団|医療法人|社会医療法人社団|社会医療法人|公益財団法人|国民健康保険)/g, "")
    .replace(/国民健康保険/g, "");

// 曜日別の診療時間列を「月・火・…」の診療曜日サマリに要約
const DAYS = ["月", "火", "水", "木", "金", "土", "日"];
function openDays(h) {
  const days = DAYS.filter(
    (d) => s(h[`${d}（午前）`]) || s(h[`${d}（午後）`])
  );
  return days.length ? `診療曜日: ${days.join("・")}` : "";
}

// ---------- SQL生成 ----------
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const qn = (v) => (v == null ? "NULL" : String(v));
const qb = (v) => (v ? "true" : "false");

async function main() {
  const lines = ["-- 自動生成: scripts/ingest.mjs（東京都オープンデータAPI取得結果）", ""];

  // ---- 1. 人口（推計）→ areas ----
  const popHits = await fetchAll(POPULATION_API);
  const popByCode = new Map();
  for (const h of popHits) {
    const code = s(h["地域コード"]);
    if (byCode.has(code)) popByCode.set(code, h);
  }
  console.log(`人口（推計）: 対象 ${popByCode.size}/${AREAS.length} 自治体`);
  for (const a of AREAS) {
    const p = popByCode.get(a.code);
    if (!p) {
      console.warn(`⚠ 人口データなし: ${a.municipality}（地域コード ${a.code}）`);
      continue;
    }
    const distance = haversineKm(a.lat, a.lng, HUB.lat, HUB.lng);
    lines.push(
      `INSERT INTO areas (slug, name, municipality, area_code, subprefecture, kind, lat, lng, population, households, area_km2, density, transport, travel_note, distance_to_hub_km) VALUES (` +
        [
          q(a.slug), q(a.name), q(a.municipality), q(a.code), q(a.subprefecture), q(a.kind),
          a.lat, a.lng,
          qn(num(p["人口／総数"])),
          qn(num(pick(p, "＜参考値＞世帯数"))),
          qn(num(pick(p, "面積"))),
          qn(num(pick(p, "人口密度"))),
          q(a.transport), q(a.travel_note),
          distance.toFixed(1),
        ].join(", ") + `);`
    );
  }

  // ---- 2. 医療機関（救急＋診療・検査）を収集して名寄せ ----
  // key: `${area_slug}:${正規化名}` → facility
  const facilities = new Map();

  const emergencyHits = await fetchAll(EMERGENCY_API);
  let emergencyKept = 0;
  for (const h of emergencyHits) {
    const area = findArea({ municipality: s(h["区市町村"]), address: s(h["所在地"]) });
    if (!area) continue;
    const name = s(h["名称"]);
    if (!name) continue;
    facilities.set(`${area.slug}:${normName(name)}`, {
      area,
      name,
      address: s(h["所在地"]).startsWith("東京都") ? s(h["所在地"]) : `東京都${s(h["所在地"])}`,
      phone: s(h["電話"]),
      is_emergency: true,
      pediatric: false,
      maternity: false,
      testing: false,
      open_hours: "",
      source: "救急医療機関一覧（東京都保健医療局）",
    });
    emergencyKept++;
  }
  console.log(`救急医療機関一覧: ${emergencyKept}/${emergencyHits.length} 件が対象エリア`);

  const clinicHits = await fetchAll(CLINIC_API);
  let clinicKept = 0;
  for (const h of clinicHits) {
    const area = findArea({
      code: s(h["行政コード"]),
      municipality: s(h["区市町村"]),
      address: s(h["正規化住所"]),
    });
    if (!area) continue;
    const name = s(h["医療機関名"]);
    if (!name) continue;
    clinicKept++;
    const key = `${area.slug}:${normName(name)}`;
    const testing = flag(h["PCR"]) || flag(h["抗原定量"]) || flag(h["抗原定性"]);
    const existing = facilities.get(key);
    if (existing) {
      // 救急側と重複 → 機能フラグをマージ
      existing.pediatric ||= flag(h["小児"]);
      existing.maternity ||= flag(h["妊婦"]);
      existing.testing ||= testing;
      existing.open_hours = existing.open_hours || openDays(h);
      continue;
    }
    facilities.set(key, {
      area,
      name,
      address: s(h["正規化住所"]),
      phone: s(h["電話番号"]),
      is_emergency: false,
      pediatric: flag(h["小児"]),
      maternity: flag(h["妊婦"]),
      testing,
      open_hours: openDays(h),
      source: "診療・検査医療機関の一覧（東京都保健医療局）",
    });
  }
  console.log(`診療・検査医療機関の一覧: ${clinicKept}/${clinicHits.length} 件が対象エリア`);

  // ---- 3. ジオコーディング（エリア中心から30km超は誤判定としてフォールバック） ----
  lines.push("");
  let geocoded = 0;
  let fallback = 0;
  for (const f of facilities.values()) {
    const g = await geocode(f.address);
    if (g && haversineKm(g.lat, g.lng, f.area.lat, f.area.lng) <= 30) {
      f.lat = g.lat;
      f.lng = g.lng;
      f.geocode_fallback = false;
      geocoded++;
    } else {
      // 島の医療機関は貴重なので除外せずエリア中心に載せる
      f.lat = f.area.lat;
      f.lng = f.area.lng;
      f.geocode_fallback = true;
      fallback++;
    }
    lines.push(
      `INSERT INTO facilities (area_slug, name, address, lat, lng, phone, is_emergency, pediatric, maternity, testing, open_hours, geocode_fallback, source) VALUES (` +
        [
          q(f.area.slug), q(f.name), q(f.address), f.lat, f.lng, q(f.phone),
          qb(f.is_emergency), qb(f.pediatric), qb(f.maternity), qb(f.testing),
          q(f.open_hours), qb(f.geocode_fallback), q(f.source),
        ].join(", ") + `);`
    );
  }

  // ---- 4. サマリ出力（0件の島の目視確認用） ----
  console.log("\n--- 自治体別の医療機関件数 ---");
  for (const a of AREAS) {
    const list = [...facilities.values()].filter((f) => f.area.slug === a.slug);
    const emergency = list.filter((f) => f.is_emergency).length;
    console.log(
      `${a.municipality.padEnd(5, "　")}: ${String(list.length).padStart(2)} 件（救急 ${emergency}）` +
        (list.length === 0 ? " ← 医療機関ゼロ" : "")
    );
  }

  writeFileSync(join(ROOT, "db", "init", "02_seed.sql"), lines.join("\n") + "\n");
  writeFileSync(GEOCACHE_PATH, JSON.stringify(geocache));
  console.log(
    `\n医療機関 ${facilities.size} 件（ジオコーディング成功 ${geocoded} / フォールバック ${fallback}）→ db/init/02_seed.sql`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
