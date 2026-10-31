import type { SiteTraffic } from "@/lib/site/traffic";

/**
 * Marketing-site traffic for the platform admin dashboard. Server component:
 * the data is already aggregated in the page render, so there is nothing to
 * hydrate on the client.
 */
export function SiteTrafficPanel({ traffic }: { traffic: SiteTraffic }) {
  const { visitors, pageViews, countries, pages, sources, daily } = traffic;
  const known = countries.filter((c) => c.country !== "");
  const maxViews = daily.reduce((m, d) => Math.max(m, d.views), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Visitors" value={visitors} hint="distinct, daily-rotating" />
        <Stat label="Page views" value={pageViews} hint={`last ${traffic.days}d`} />
        <Stat label="Countries" value={known.length} hint="with at least one visit" />
      </div>

      {pageViews === 0 ? (
        <div className="card px-4 py-6 text-sm text-navy-500">
          No marketing-site traffic recorded yet. Page views appear here from the next visit to the
          public site (visits inside the app are not counted).
        </div>
      ) : (
        <>
          <div className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-navy-400">Daily views</div>
            <div className="mt-3 flex h-28 items-end gap-1" role="img" aria-label="Daily page views">
              {daily.map((d) => (
                <div
                  key={d.date}
                  className="flex-1 rounded-t bg-brand-500/70"
                  style={{ height: maxViews > 0 ? `${Math.max(4, Math.round((d.views / maxViews) * 100))}%` : "4px" }}
                  title={`${d.date}: ${d.views} views, ${d.visitors} visitors`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-navy-400">
              <span>{daily[0]?.date ?? ""}</span>
              <span>{daily[daily.length - 1]?.date ?? ""}</span>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-navy-100 px-4 py-3 text-xs font-medium uppercase tracking-wide text-navy-400">
              Top sources
            </div>
            {sources.length === 0 ? (
              <div className="px-4 py-6 text-sm text-navy-500">No source data yet.</div>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Traffic by campaign or referrer</caption>
                <thead>
                  <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400">
                    <th scope="col" className="px-4 py-2 font-medium">Source</th>
                    <th scope="col" className="px-4 py-2 font-medium">Campaign</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right">Visitors</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={`${s.kind}:${s.source}:${s.campaign}`} className="border-b border-navy-50 last:border-0">
                      <td className="px-4 py-2 text-navy-700">
                        <span className="font-mono text-xs">{s.source}</span>
                        {s.kind === "campaign" ? (
                          <span className="ml-2 rounded bg-navy-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-navy-500">
                            tagged
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-xs text-navy-500">{s.campaign || "—"}</td>
                      <td className="px-4 py-2 text-right text-navy-700">{s.visitors}</td>
                      <td className="px-4 py-2 text-right text-navy-500">{s.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-navy-100 px-4 py-3 text-xs font-medium uppercase tracking-wide text-navy-400">
            Top countries
          </div>
          {countries.length === 0 ? (
            <div className="px-4 py-6 text-sm text-navy-500">No country data yet.</div>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Traffic by country</caption>
              <thead>
                <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400">
                  <th scope="col" className="px-4 py-2 font-medium">Country</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Visitors</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Views</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {countries.map((c) => (
                  <tr key={c.country || "unknown"} className="border-b border-navy-50 last:border-0">
                    <td className="px-4 py-2 text-navy-700">
                      {c.name}
                      {c.country ? <span className="ml-2 font-mono text-xs text-navy-400">{c.country}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right text-navy-700">{c.visitors}</td>
                    <td className="px-4 py-2 text-right text-navy-500">{c.views}</td>
                    <td className="px-4 py-2 text-right text-navy-500">{c.share}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-navy-100 px-4 py-3 text-xs font-medium uppercase tracking-wide text-navy-400">
            Top pages
          </div>
          {pages.length === 0 ? (
            <div className="px-4 py-6 text-sm text-navy-500">No page data yet.</div>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Traffic by page</caption>
              <thead>
                <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400">
                  <th scope="col" className="px-4 py-2 font-medium">Page</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Views</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.path} className="border-b border-navy-50 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs text-navy-700">{p.path}</td>
                    <td className="px-4 py-2 text-right text-navy-700">{p.views}</td>
                    <td className="px-4 py-2 text-right text-navy-500">{p.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-navy-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-navy-950">{value.toLocaleString()}</div>
      {hint ? <div className="mt-0.5 text-xs text-navy-400">{hint}</div> : null}
    </div>
  );
}
