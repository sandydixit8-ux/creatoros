"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Badge, ProgressBar } from "@/components/ui";

type Progress = {
  status: string;
  progress: {
    pagesDiscovered: number;
    pagesAnalyzed: number;
    issuesFound: number;
    keywordsFound: number;
    questionsFound: number;
    opportunitiesFound: number;
  };
  error: string | null;
};

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ token: string; metaTag: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [audience, setAudience] = useState("");
  const [products, setProducts] = useState("");
  const [keywords, setKeywords] = useState("");
  const [competitors, setCompetitors] = useState("");

  async function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await api<{ website: { id: string } }>("/api/websites", {
      json: { url, name: name || undefined },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setWebsiteId(res.data.website.id);
    setStep(2);
  }

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!websiteId) return;
    setBusy(true);
    const res = await api(`/api/websites/${websiteId}`, {
      method: "PATCH",
      json: {
        industry: industry || null,
        country: country || null,
        audience: audience || null,
        products: products || null,
        primaryKeywords: keywords || null,
        competitors: competitors ? competitors.split(",").map((c) => c.trim()).filter(Boolean) : [],
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const verify = await api<{ token: string; metaTag: string }>(`/api/websites/${websiteId}/verify`);
    if (verify.ok) setTokenInfo({ token: verify.data.token, metaTag: verify.data.metaTag });
    setStep(3);
  }

  async function startCrawl() {
    if (!websiteId) return;
    setBusy(true);
    const res = await api<{ runId: string }>(`/api/websites/${websiteId}/crawl`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setStep(4);
    pollRef.current = setInterval(async () => {
      const r = await api<{ run: Progress }>(`/api/crawl-runs/${res.data.runId}`);
      if (r.ok) {
        setProgress(r.data.run);
        if (["done", "failed", "cancelled"].includes(r.data.run.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    }, 1500);
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const finished = progress?.status === "done";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">R</span>
          RankPilot AI
        </Link>
        <span className="text-xs text-ink-400">Step {step} of 4</span>
      </div>
      <ProgressBar value={step} max={4} />

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {step === 1 ? (
        <form onSubmit={submitUrl} className="card mt-6 p-6">
          <h1 className="text-xl font-semibold text-ink-900">Which website should we analyze?</h1>
          <p className="mt-1 text-sm text-ink-500">We&apos;ll crawl it like a respectful search engine — robots.txt is honored.</p>
          <div className="mt-5">
            <label className="label" htmlFor="url">Website URL</label>
            <input id="url" className="input" placeholder="https://example.com" required value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="name">Display name (optional)</label>
            <input id="name" className="input" placeholder="Acme Inc." value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn-primary mt-6 w-full" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : null}

      {step === 2 ? (
        <form onSubmit={submitProfile} className="card mt-6 p-6">
          <h1 className="text-xl font-semibold text-ink-900">Tell us about your business</h1>
          <p className="mt-1 text-sm text-ink-500">This sharpens keyword, intent and content recommendations. All fields optional.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="industry">Industry</label>
              <input id="industry" className="input" placeholder="SaaS, retail, legal…" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="country">Country</label>
              <input id="country" className="input" placeholder="India, United States…" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="audience">Target audience</label>
              <input id="audience" className="input" placeholder="Who you serve" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="products">Products / services</label>
              <input id="products" className="input" placeholder="What you sell" value={products} onChange={(e) => setProducts(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="keywords">Primary keywords</label>
              <input id="keywords" className="input" placeholder="Comma separated: project management, crm software…" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="competitors">Competitors (optional)</label>
              <input id="competitors" className="input" placeholder="Comma separated URLs: https://competitor.com…" value={competitors} onChange={(e) => setCompetitors(e.target.value)} />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setStep(1)}>Back</button>
            <button className="btn-primary flex-1" disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <div className="card mt-6 p-6">
          <h1 className="text-xl font-semibold text-ink-900">Verify & launch</h1>
          <p className="mt-1 text-sm text-ink-500">
            Verification is optional — it helps us confirm ownership. You can start the crawl right away.
          </p>
          {tokenInfo ? (
            <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-400">Add this to your homepage &lt;head&gt;</div>
              <code className="mt-2 block overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-white p-3 text-xs text-ink-700">
                {tokenInfo.metaTag}
              </code>
            </div>
          ) : null}
          <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-ink-700">
            <strong>What happens next:</strong> we discover your pages (sitemap + robots + links), analyze
            every page for technical SEO, on-page quality, AEO and GEO readiness, then build your Growth
            Score and prioritized action list.
          </div>
          <div className="mt-6 flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setStep(2)}>Back</button>
            <button className="btn-primary flex-1" onClick={startCrawl} disabled={busy}>
              {busy ? "Starting…" : "Start my growth audit"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="card mt-6 p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-ink-900">Analyzing your website</h1>
            <Badge tone={finished ? "completed" : progress?.status === "failed" ? "critical" : "new"}>
              {finished ? "complete" : (progress?.status ?? "starting")}
            </Badge>
          </div>
          <div className="mt-5">
            <ProgressBar value={progress?.progress.pagesAnalyzed ?? 0} max={Math.max(progress?.progress.pagesDiscovered ?? 10, 10)} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Pages discovered", progress?.progress.pagesDiscovered ?? 0],
              ["Pages analyzed", progress?.progress.pagesAnalyzed ?? 0],
              ["Issues found", progress?.progress.issuesFound ?? 0],
              ["Keywords discovered", progress?.progress.keywordsFound ?? 0],
              ["Questions discovered", progress?.progress.questionsFound ?? 0],
              ["Opportunities", progress?.progress.opportunitiesFound ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2">
                <div className="text-xs text-ink-500">{label}</div>
                <div className="text-lg font-semibold text-ink-900">{value as number}</div>
              </div>
            ))}
          </div>
          {progress?.status === "failed" ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Crawl failed: {progress.error ?? "unknown error"} — you can retry from your dashboard.
            </p>
          ) : null}
          {finished && websiteId ? (
            <div className="mt-6 flex gap-3">
              <Link href={`/app/websites/${websiteId}/report`} className="btn-primary flex-1">
                View my Growth Report
              </Link>
              <Link href="/app" className="btn-secondary flex-1">
                Go to dashboard
              </Link>
            </div>
          ) : (
            <p className="mt-5 text-sm text-ink-500">
              This usually takes under a minute for small sites. You can leave this page — the audit
              continues in the background.
            </p>
          )}
        </div>
      ) : null}
    </main>
  );
}
