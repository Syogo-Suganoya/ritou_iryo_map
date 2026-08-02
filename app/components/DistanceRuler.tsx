// 「距離定規」— 本土（都立広尾病院）までの直線距離を海図の距離目盛りに見立てて表示する
// このアプリのシグネチャー要素。伊豆諸島(~100〜350km)と小笠原(~1000km)の桁差を
// 対数目盛りで一本の定規上に収め、遠さを一目で比較できるようにする。

const TICKS_KM = [10, 30, 100, 300, 1000];
const MIN_KM = 10;
const MAX_KM = 1200;

function pos(km: number): number {
  const clamped = Math.min(Math.max(km, MIN_KM), MAX_KM);
  const t = (Math.log10(clamped) - Math.log10(MIN_KM)) / (Math.log10(MAX_KM) - Math.log10(MIN_KM));
  return t * 100;
}

export default function DistanceRuler({
  km,
  tone = "light",
  color,
  label = "本土（広尾病院）まで",
}: {
  km: number;
  tone?: "light" | "dark";
  color?: string;
  label?: string;
}) {
  const lineColor = tone === "light" ? "var(--text-ink-muted)" : "var(--text-parchment-muted)";
  const textColor = tone === "light" ? "var(--text-ink)" : "var(--text-parchment)";
  const markColor = color ?? (tone === "light" ? "var(--accent)" : "var(--accent-bright)");
  const x = pos(km);

  return (
    <div className="w-full select-none">
      <div className="eyebrow mb-1" style={{ color: lineColor }}>
        {label}
      </div>
      <svg viewBox="0 0 100 22" preserveAspectRatio="none" className="w-full h-7 overflow-visible">
        <line x1="0" y1="16" x2="100" y2="16" stroke={lineColor} strokeWidth="0.5" />
        {TICKS_KM.map((t) => (
          <g key={t}>
            <line x1={pos(t)} y1="12.5" x2={pos(t)} y2="16" stroke={lineColor} strokeWidth="0.5" />
            <text
              x={pos(t)}
              y="10.5"
              fontSize="4.6"
              textAnchor="middle"
              fill={lineColor}
              className="font-data"
            >
              {t}
            </text>
          </g>
        ))}
        <line x1={x} y1="4" x2={x} y2="16" stroke={markColor} strokeWidth="1" />
        <circle cx={x} cy="16" r="2.1" fill={markColor} stroke={tone === "light" ? "var(--parchment)" : "var(--ink-2)"} strokeWidth="0.8" />
      </svg>
      <div className="font-data text-sm font-bold mt-0.5" style={{ color: textColor }}>
        約{Math.round(km).toLocaleString()}km
      </div>
    </div>
  );
}
