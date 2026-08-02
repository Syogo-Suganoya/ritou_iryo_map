import type { Facility } from "@/lib/gap";

export default function FacilityTable({ facilities }: { facilities: Facility[] }) {
  if (!facilities.length) {
    return (
      <p className="text-sm" style={{ color: "var(--danger)" }}>
        オープンデータに登録された医療機関がありません。
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr className="text-left eyebrow hairline-b" style={{ color: "var(--text-ink-muted)" }}>
            <th className="py-2 pr-3 font-normal">名称</th>
            <th className="py-2 pr-3 font-normal">対応</th>
            <th className="py-2 pr-3 font-normal">診療曜日</th>
            <th className="py-2 font-normal">電話</th>
          </tr>
        </thead>
        <tbody>
          {facilities.map((f) => (
            <tr key={f.id} className="hairline-b align-top">
              <td className="py-2 pr-3">
                <div className="font-bold">
                  {f.is_emergency && (
                    <span className="chip chip-critical mr-1.5 align-middle">救急</span>
                  )}
                  {f.name}
                </div>
                <div className="text-xs" style={{ color: "var(--text-ink-muted)" }}>{f.address}</div>
              </td>
              <td className="py-2 pr-3">
                <div className="flex flex-wrap gap-1">
                  {f.pediatric && (
                    <span className="text-[10px] px-1.5 py-0.5" style={{ background: "var(--parchment-deep)", color: "var(--text-ink)" }}>小児</span>
                  )}
                  {f.maternity && (
                    <span className="text-[10px] px-1.5 py-0.5" style={{ background: "var(--parchment-deep)", color: "var(--text-ink)" }}>妊婦</span>
                  )}
                  {f.testing && (
                    <span className="text-[10px] px-1.5 py-0.5" style={{ background: "var(--parchment-deep)", color: "var(--text-ink)" }}>検査</span>
                  )}
                </div>
              </td>
              <td className="py-2 pr-3 text-xs" style={{ color: "var(--text-ink-muted)" }}>
                {f.open_hours.replace("診療曜日: ", "") || "—"}
              </td>
              <td className="py-2 text-xs font-data">{f.phone || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
