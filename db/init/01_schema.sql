-- 島しょ・へき地医療アクセス可視化マップ スキーマ

-- 対象エリア（島しょ9町村＋西多摩へき地2町村）
CREATE TABLE areas (
  slug               text PRIMARY KEY,   -- oshima, hachijo, ogasawara など
  name               text NOT NULL,      -- 表示名（大島、八丈島 など）
  municipality       text NOT NULL,      -- 自治体名（大島町 など）
  area_code          text NOT NULL,      -- 行政コード5桁
  subprefecture      text NOT NULL,      -- 大島支庁 / 三宅支庁 / 八丈支庁 / 小笠原支庁 / 西多摩
  kind               text NOT NULL,      -- island(島しょ) / hekichi(山間へき地)
  lat                double precision NOT NULL,  -- エリア中心（役場付近）
  lng                double precision NOT NULL,
  population         integer NOT NULL,   -- 人口（東京都の人口(推計)）
  households         integer,            -- 世帯数
  area_km2           numeric,            -- 面積
  density            numeric,            -- 人口密度
  transport          text NOT NULL,      -- 本土への主な移動手段
  travel_note        text NOT NULL DEFAULT '',   -- 所要時間などの補足
  distance_to_hub_km numeric NOT NULL    -- 基幹病院（都立広尾病院）までの直線距離
);

-- 医療機関（救急医療機関一覧＋診療・検査医療機関の一覧から抽出）
CREATE TABLE facilities (
  id               serial PRIMARY KEY,
  area_slug        text NOT NULL REFERENCES areas(slug),
  name             text NOT NULL,
  address          text NOT NULL DEFAULT '',
  lat              double precision NOT NULL,
  lng              double precision NOT NULL,
  phone            text NOT NULL DEFAULT '',
  is_emergency     boolean NOT NULL DEFAULT false, -- 救急告示医療機関
  pediatric        boolean NOT NULL DEFAULT false, -- 小児対応
  maternity        boolean NOT NULL DEFAULT false, -- 妊婦対応
  testing          boolean NOT NULL DEFAULT false, -- 検査対応
  open_hours       text NOT NULL DEFAULT '',
  geocode_fallback boolean NOT NULL DEFAULT false, -- 住所解決失敗でエリア中心座標を使用
  source           text NOT NULL DEFAULT ''
);

CREATE INDEX facilities_area_idx ON facilities (area_slug);

-- 医療アクセスギャップ指標（＝医療孤立度）
-- gap_score = 基幹病院（都立広尾病院）までの距離km
--             × 救急補正（救急告示医療機関なし: ×1.5）
--             × 医療機能補正（小児対応なし: ×1.2、妊婦対応なし: ×1.2、医療機関ゼロ: ×2）
-- 補助指標として「一機関あたり人口 pop_per_facility」も算出（設計書の人口対比指標）
CREATE VIEW area_gap AS
WITH f AS (
  SELECT
    area_slug,
    COUNT(*)                              AS facility_count,
    COUNT(*) FILTER (WHERE is_emergency)  AS emergency_count,
    COUNT(*) FILTER (WHERE pediatric)     AS pediatric_count,
    COUNT(*) FILTER (WHERE maternity)     AS maternity_count
  FROM facilities
  GROUP BY area_slug
),
scored AS (
  SELECT
    a.*,
    COALESCE(f.facility_count, 0)  AS facility_count,
    COALESCE(f.emergency_count, 0) AS emergency_count,
    COALESCE(f.pediatric_count, 0) AS pediatric_count,
    COALESCE(f.maternity_count, 0) AS maternity_count,
    CASE WHEN COALESCE(f.facility_count, 0) > 0
         THEN ROUND(a.population::numeric / f.facility_count)
    END AS pop_per_facility,
    ROUND(
      a.distance_to_hub_km
      * CASE WHEN COALESCE(f.emergency_count, 0) = 0 THEN 1.5 ELSE 1.0 END
      * CASE WHEN COALESCE(f.pediatric_count, 0) = 0 THEN 1.2 ELSE 1.0 END
      * CASE WHEN COALESCE(f.maternity_count, 0) = 0 THEN 1.2 ELSE 1.0 END
      * CASE WHEN COALESCE(f.facility_count, 0) = 0 THEN 2.0 ELSE 1.0 END
    ) AS gap_score
  FROM areas a
  LEFT JOIN f ON f.area_slug = a.slug
)
SELECT
  *,
  RANK() OVER (ORDER BY gap_score DESC) AS priority_rank
FROM scored;
