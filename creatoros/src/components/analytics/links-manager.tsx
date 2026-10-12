"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, MousePointerClick, Plus, Trash2 } from "lucide-react";
import type { Campaign, LinkPerformance, TrackedLink } from "@/lib/analytics/links";

interface Props {
  campaigns: Campaign[];
  links: TrackedLink[];
  performance: LinkPerformance[];
  shortBase: string;
}

const input = "rounded-xl border border-night-600 bg-night-950 px-3 py-2 text-sm text-night-100 placeholder:text-night-500 focus:border-brand-500 focus:outline-none";

export function LinksManager({ campaigns, links, performance, shortBase }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  // campaign form
  const [campName, setCampName] = useState("");
  const [campSource, setCampSource] = useState("");
  const [campMedium, setCampMedium] = useState("");

  // link form
  const [linkLabel, setLinkLabel] = useState("");
  const [linkDest, setLinkDest] = useState("");
  const [linkSlug, setLinkSlug] = useState("");
  const [linkCampaign, setLinkCampaign] = useState("");

  const clicksByLink = new Map(performance.map((p) => [p.linkId, p.clicks]));

  async function send(method: string, url: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(j?.error?.message || "Something went wrong");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addCampaign(e: React.FormEvent) {
    e.preventDefault();
    const okDone = await send("POST", "/api/analytics/campaigns", {
      name: campName,
      utm_source: campSource,
      utm_medium: campMedium,
    });
    if (okDone) {
      setCampName("");
      setCampSource("");
      setCampMedium("");
    }
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    const okDone = await send("POST", "/api/analytics/links", {
      label: linkLabel,
      destination: linkDest,
      slug: linkSlug.trim() || undefined,
      campaignId: linkCampaign || null,
    });
    if (okDone) {
      setLinkLabel("");
      setLinkDest("");
      setLinkSlug("");
      setLinkCampaign("");
    }
  }

  async function copy(slug: string) {
    const url = `${shortBase}/l/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(slug);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-night-700 bg-night-900 p-5">
          <h2 className="font-semibold text-white">New campaign</h2>
          <p className="mt-1 text-xs text-night-400">A campaign is a UTM set that tracked links inherit.</p>
          <form onSubmit={addCampaign} className="mt-4 space-y-3">
            <input className={`${input} w-full`} placeholder="Campaign name (e.g. Diwali launch)" value={campName} onChange={(e) => setCampName(e.target.value)} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} placeholder="utm_source (e.g. instagram)" value={campSource} onChange={(e) => setCampSource(e.target.value)} />
              <input className={input} placeholder="utm_medium (e.g. social)" value={campMedium} onChange={(e) => setCampMedium(e.target.value)} />
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
              <Plus className="h-4 w-4" /> Create campaign
            </button>
          </form>

          <div className="mt-5 space-y-2">
            {campaigns.length === 0 ? (
              <p className="text-sm text-night-500">No campaigns yet.</p>
            ) : (
              campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-night-700 bg-night-950 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-night-100">{c.name}</div>
                    <div className="truncate text-xs text-night-500">
                      {[c.utmSource, c.utmMedium, c.utmCampaign].filter(Boolean).join(" · ") || "no UTM"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => send("DELETE", `/api/analytics/campaigns/${c.id}`)}
                    className="rounded-lg p-1.5 text-night-500 transition-colors hover:bg-night-800 hover:text-red-300"
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-night-700 bg-night-900 p-5">
          <h2 className="font-semibold text-white">New tracked link</h2>
          <p className="mt-1 text-xs text-night-400">Short links record consent-gated clicks, then redirect with campaign UTMs.</p>
          <form onSubmit={addLink} className="mt-4 space-y-3">
            <input className={`${input} w-full`} placeholder="Label (e.g. Link in bio)" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
            <input className={`${input} w-full`} type="url" placeholder="https://destination.com/page" value={linkDest} onChange={(e) => setLinkDest(e.target.value)} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} placeholder="slug (optional)" value={linkSlug} onChange={(e) => setLinkSlug(e.target.value)} />
              <select className={input} value={linkCampaign} onChange={(e) => setLinkCampaign(e.target.value)}>
                <option value="">No campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
              <Plus className="h-4 w-4" /> Create link
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-night-700 bg-night-900 p-5">
        <h2 className="font-semibold text-white">Tracked links</h2>
        {links.length === 0 ? (
          <p className="mt-3 text-sm text-night-500">No tracked links yet. Create one above to start measuring campaigns.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-night-700 text-left text-xs uppercase tracking-wider text-night-500">
                  <th className="py-2 pr-3 font-medium">Link</th>
                  <th className="py-2 pr-3 font-medium">Destination</th>
                  <th className="py-2 pr-3 font-medium">Clicks</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {links.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-night-100">{l.label || "(no label)"}</div>
                      <button type="button" onClick={() => copy(l.slug)} className="mt-0.5 flex items-center gap-1 text-xs text-brand-300 hover:text-brand-200">
                        <span className="truncate">/l/{l.slug}</span>
                        {copied === l.slug ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3">
                      <a href={l.destination} target="_blank" rel="noreferrer" className="flex max-w-[220px] items-center gap-1 truncate text-night-300 hover:text-white">
                        <span className="truncate">{l.destination}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </td>
                    <td className="py-2.5 pr-3 text-night-100">
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="h-3.5 w-3.5 text-night-500" /> {clicksByLink.get(l.id) ?? 0}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => send("PATCH", `/api/analytics/links/${l.id}`, { active: !l.active })}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.active ? "bg-emerald-500/15 text-emerald-300" : "bg-night-700 text-night-400"}`}
                      >
                        {l.active ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => send("DELETE", `/api/analytics/links/${l.id}`)}
                        className="rounded-lg p-1.5 text-night-500 transition-colors hover:bg-night-800 hover:text-red-300"
                        aria-label="Delete link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
