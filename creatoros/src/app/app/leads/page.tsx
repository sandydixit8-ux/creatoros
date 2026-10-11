import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, Mail, UserPlus } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { all, row } from "@/lib/db/db";
import { getLimits } from "@/lib/plans";
import { getUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function LeadsPage({ searchParams }: Props) {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const sp = await searchParams;
  const q = (sp.q || "").trim().toLowerCase();

  const org = row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", s.org.id);
  const limits = getLimits(org?.plan ?? "free");
  const used = getUsage(s.org.id, "contacts");

  const contacts = q
    ? all<{ id: string; email: string; name: string; consent: number; source: string; utm_source: string; utm_campaign: string; page_id: string; created_at: string }>(
        "SELECT id, email, name, consent, source, utm_source, utm_campaign, page_id, created_at FROM contacts WHERE tenant_id = ? AND (LOWER(email) LIKE ? OR LOWER(name) LIKE ?) ORDER BY created_at DESC LIMIT 100",
        s.org.id,
        `%${q}%`,
        `%${q}%`
      )
    : all<{ id: string; email: string; name: string; consent: number; source: string; utm_source: string; utm_campaign: string; page_id: string; created_at: string }>(
        "SELECT id, email, name, consent, source, utm_source, utm_campaign, page_id, created_at FROM contacts WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100",
        s.org.id
      );

  const total = (row<{ c: number }>("SELECT COUNT(*) AS c FROM contacts WHERE tenant_id = ?", s.org.id) as { c: number }).c;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Leads</h1>
          <p className="mt-1 text-sm text-navy-500">
            {total} contact{total === 1 ? "" : "s"} collected {used}/{limits.contacts === -1 ? "∞" : limits.contacts}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form method="GET" className="relative">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search email or name…"
              aria-label="Search leads by email or name"
              className="input w-64"
            />
          </form>
          <a href="/api/leads/export" className="btn-secondary">
            <Download className="h-4 w-4" /> CSV
          </a>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="card p-10 text-center">
          <UserPlus className="mx-auto h-8 w-8 text-navy-300" />
          <h2 className="mt-3 font-semibold text-navy-900">No leads yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-navy-500">
            Add an email capture block to your bio page to start collecting contacts with their consent.
          </p>
          <Link href="/app/bio" className="btn-primary mt-4">Go to bio pages</Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Leads</caption>
            <thead>
              <tr className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-400">
                <th scope="col" className="px-5 py-3 font-medium">Contact</th>
                <th scope="col" className="px-5 py-3 font-medium">Consent</th>
                <th scope="col" className="px-5 py-3 font-medium">Source</th>
                <th scope="col" className="px-5 py-3 font-medium">Campaign</th>
                <th scope="col" className="px-5 py-3 font-medium">Captured</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-navy-50 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-navy-900">{c.name || "—"}</div>
                    <div className="flex items-center gap-1 text-navy-500"><Mail className="h-3 w-3" /> {c.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.consent ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {c.consent ? "Opted in" : "Pending"}
                    </span>
                  </td>
                  <td className="px-5 py-3 capitalize text-navy-600">{c.source || "bio"}</td>
                  <td className="px-5 py-3 text-navy-600">{c.utm_campaign || "—"}</td>
                  <td className="px-5 py-3 text-navy-500">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {limits.contacts !== -1 && used >= limits.contacts && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You&apos;ve reached your plan&apos;s contact limit ({limits.contacts}). <Link href="/app/billing" className="underline">Upgrade to keep capturing leads →</Link>
        </div>
      )}
    </div>
  );
}