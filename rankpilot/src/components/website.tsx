"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { cn } from "@/components/ui";

const TABS = (id: string) => [
  { href: `/app/websites/${id}`, label: "Overview", exact: true },
  { href: `/app/websites/${id}/issues`, label: "Issues" },
  { href: `/app/websites/${id}/pages`, label: "Pages" },
  { href: `/app/websites/${id}/keywords`, label: "Keywords" },
  { href: `/app/websites/${id}/questions`, label: "Questions" },
  { href: `/app/websites/${id}/links`, label: "Links" },
  { href: `/app/websites/${id}/schema`, label: "Schema" },
  { href: `/app/websites/${id}/topics`, label: "Topics" },
  { href: `/app/websites/${id}/competitors`, label: "Competitors" },
  { href: `/app/websites/${id}/labs`, label: "Labs" },
  { href: `/app/websites/${id}/report`, label: "Growth Report" },
];

export function WebsiteTabs({ websiteId }: { websiteId: string }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-ink-200 bg-white">
      {TABS(websiteId).map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium",
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-800"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export function CrawlButton({ websiteId, running }: { websiteId: string; running: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await api<{ runId: string }>(`/api/websites/${websiteId}/crawl`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.refresh();
  }

  if (running) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink-500">
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" />
          Crawl in progress…
        </span>
        <button className="btn-secondary" onClick={() => router.refresh()}>Refresh</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button className="btn-primary" onClick={start} disabled={busy}>
        {busy ? "Starting…" : "Re-run crawl & audit"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
