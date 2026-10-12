import type { DeviceRow, SourceRow } from "@/lib/analytics/reporting";

function BarList({ title, rows, color }: { title: string; rows: SourceRow[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-night-400">{title}</div>
      {rows.length === 0 ? (
        <div className="py-4 text-sm text-navy-400">No data</div>
      ) : (
        <ul className="space-y-2.5">
          {rows.slice(0, 7).map((r) => (
            <li key={r.source}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="max-w-[70%] truncate text-night-100" title={r.source}>{r.source}</span>
                <span className="text-night-400">{r.visitors} <span className="text-night-500">· {r.share}%</span></span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-night-800">
                <div className="h-full rounded-full" style={{ width: `${Math.max(3, (r.visitors / max) * 100)}%`, background: color }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SourcePanel({ sources, campaigns, devices }: { sources: SourceRow[]; campaigns: SourceRow[]; devices: DeviceRow[] }) {
  const deviceRows: SourceRow[] = devices.map((d) => ({ source: d.device, visitors: d.visitors, pageViews: d.pageViews, conversions: 0, share: d.share }));
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <BarList title="Top sources" rows={sources} color="#8b5cf6" />
      <BarList title="Campaigns (UTM)" rows={campaigns} color="#22d3ee" />
      <BarList title="Devices" rows={deviceRows} color="#f59e0b" />
    </div>
  );
}
