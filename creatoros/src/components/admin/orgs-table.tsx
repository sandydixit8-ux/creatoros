"use client";

import { useState } from "react";

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  members: number;
  created_at: string;
}

export function OrgsTable({ initial, plans }: { initial: Org[]; plans: string[] }) {
  const [orgs, setOrgs] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function save(org: Org, plan: string) {
    if (plan === org.plan) return;
    setBusy(org.id);
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json.ok) setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, plan } : o)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Organizations</caption>
        <thead className="border-b border-navy-100 text-xs uppercase text-navy-400">
          <tr>
            <th scope="col" className="px-4 py-3">Organization</th>
            <th scope="col" className="px-4 py-3">Members</th>
            <th scope="col" className="px-4 py-3">Created</th>
            <th scope="col" className="px-4 py-3">Plan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-50">
          {orgs.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-navy-500">No organizations yet.</td>
            </tr>
          )}
          {orgs.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3">
                <div className="font-semibold text-navy-900">{o.name}</div>
                <div className="text-xs text-navy-400">{o.slug}</div>
              </td>
              <td className="px-4 py-3 text-navy-600">{o.members}</td>
              <td className="px-4 py-3 text-navy-600">{new Date(o.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <select
                  value={o.plan}
                  disabled={busy === o.id}
                  onChange={(e) => save(o, e.target.value)}
                  className="input !w-32 !py-1.5 text-sm capitalize"
                >
                  {plans.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}