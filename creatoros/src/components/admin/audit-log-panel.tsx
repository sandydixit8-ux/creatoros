"use client";

import { useState } from "react";

interface Entry {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  action: string;
  resource: string;
  meta: string;
  ip: string;
  created_at: string;
  email: string | null;
}

export function AuditLogPanel({ initial }: { initial: Entry[] }) {
  const [entries, setEntries] = useState(initial);
  const [action, setAction] = useState("");
  const [org, setOrg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      if (action.trim()) qs.set("action", action.trim());
      if (org.trim()) qs.set("tenantId", org.trim());
      const res = await fetch(`/api/admin/audit?${qs.toString()}`);
      const json = await res.json();
      if (json.ok) setEntries(json.data.entries);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={load} className="flex flex-wrap items-end gap-3">
        <label className="min-w-[14rem] flex-1">
          <span className="label">Action contains</span>
          <input
            className="input"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g. refund, plan_change"
          />
        </label>
        <label>
          <span className="label">Workspace</span>
          <input className="input" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="org_…" />
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Loading…" : "Filter"}
        </button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Audit log</caption>
          <thead className="border-b border-navy-100 text-xs uppercase text-navy-400">
            <tr>
              <th scope="col" className="px-4 py-3">Time</th>
              <th scope="col" className="px-4 py-3">Action</th>
              <th scope="col" className="px-4 py-3">Workspace</th>
              <th scope="col" className="px-4 py-3">Resource</th>
              <th scope="col" className="px-4 py-3">Actor</th>
              <th scope="col" className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-50">
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-navy-500">No audit entries.</td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-3 text-navy-500">{e.created_at.slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-3 font-medium text-navy-800">{e.action}</td>
                <td className="px-4 py-3 font-mono text-xs text-navy-600">{e.tenant_id ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-navy-500">{e.resource || "—"}</td>
                <td className="px-4 py-3 text-navy-600">{e.email ?? e.user_id ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-navy-500">
                  {e.meta && e.meta !== "{}" ? (
                    <details>
                      <summary className="cursor-pointer">view</summary>
                      <pre className="mt-1 max-w-xs overflow-x-auto whitespace-pre-wrap break-all rounded bg-navy-50 p-2 text-[11px] text-navy-600">{pretty(e.meta)}</pre>
                    </details>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pretty(meta: string): string {
  try {
    return JSON.stringify(JSON.parse(meta), null, 2);
  } catch {
    return meta;
  }
}
