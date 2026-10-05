import type { FunnelSummary } from "@/lib/funnel";

const STEP_LABELS: Record<string, string> = {
  signup_completed: "Signed up",
  activation_reached: "Activated",
  checkout_started: "Started checkout",
  purchase_completed: "Paid",
  subscription_canceled: "Cancelled",
};

/**
 * Platform acquisition funnel. Read-only and rendered on the server: it is
 * reporting over data the admin already has, so there is nothing to interact with
 * and no reason to ship a client bundle for it.
 */
export function FunnelPanel({ summary }: { summary: FunnelSummary }) {
  const { steps, conversion, recentSignups } = summary;
  const total = recentSignups.length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {steps.map((s) => (
          <div key={s.step} className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-navy-400">{STEP_LABELS[s.step] ?? s.step}</div>
            <div className="mt-1 text-2xl font-bold text-navy-950">{s.count}</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-navy-400">Conversion ({summary.days}d)</div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          {conversion.map((c) => (
            <div key={`${c.from}-${c.to}`} className="text-sm text-navy-600">
              <span className="text-navy-500">{STEP_LABELS[c.from] ?? c.from}</span>
              <span className="mx-1 text-navy-300">&rarr;</span>
              <span className="text-navy-500">{STEP_LABELS[c.to] ?? c.to}</span>
              <span className="ml-2 font-semibold text-navy-950">{c.rate === null ? "—" : `${c.rate}%`}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-navy-100 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-navy-400">
            Recent signups ({total})
          </div>
        </div>
        {recentSignups.length === 0 ? (
          <div className="px-4 py-6 text-sm text-navy-500">
            No signups recorded yet. Events appear here from the moment a registration succeeds.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400">
                <th className="px-4 py-2 font-medium">Workspace</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Activated</th>
                <th className="px-4 py-2 font-medium">Paid</th>
                <th className="px-4 py-2 font-medium">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {recentSignups.map((s) => (
                <tr key={s.tenant_id} className="border-b border-navy-50 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-navy-700">{s.tenant_id}</td>
                  <td className="px-4 py-2 text-navy-600">{s.source || "—"}</td>
                  <td className="px-4 py-2">
                    <Badge on={s.activated} />
                  </td>
                  <td className="px-4 py-2">
                    <Badge on={s.paid} />
                  </td>
                  <td className="px-4 py-2 text-navy-500">{s.created_at.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Badge({ on }: { on: boolean }) {
  return (
    <span
      className={
        on
          ? "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
          : "inline-flex rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-400"
      }
    >
      {on ? "yes" : "no"}
    </span>
  );
}