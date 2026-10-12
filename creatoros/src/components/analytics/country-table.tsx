import type { CountryRow } from "@/lib/analytics/reporting";

function flag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function CountryTable({ rows, exportHref }: { rows: CountryRow[]; exportHref: string }) {
  if (rows.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-night-400">No country data in this range</div>;
  }
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-night-400">{rows.length} countries</span>
        <a href={exportHref} className="text-xs font-medium text-brand-300 hover:text-brand-200">Export CSV</a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-night-400">
              <th className="pb-2 font-medium">Country</th>
              <th className="pb-2 text-right font-medium">Visitors</th>
              <th className="pb-2 text-right font-medium">Views</th>
              <th className="pb-2 text-right font-medium">Leads</th>
              <th className="pb-2 pl-4 font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.country} className="border-t border-night-800">
                <td className="py-2 pr-3 text-white">
                  <span className="mr-2">{flag(r.country)}</span>
                  {r.name}
                </td>
                <td className="py-2 text-right font-medium text-white">{r.visitors}</td>
                <td className="py-2 text-right text-night-400">{r.pageViews}</td>
                <td className="py-2 text-right text-night-400">{r.leads}</td>
                <td className="py-2 pl-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-night-800">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, (r.visitors / max) * 100)}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs text-night-400">{r.share}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
