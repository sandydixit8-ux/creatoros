import Link from "next/link";
import { PLAN_PRICES } from "@/lib/plans";
import { FloatingHero } from "@/components/hero-3d";
import { Reveal, Stagger, StaggerItem, Tilt, FloatPanel, Layer, Parallax, FloatingChip } from "@/components/motion-3d";

const MODULES = [
  {
    title: "Technical & On-Page SEO",
    body: "Crawl every page, detect titles, metas, headings, canonicals, indexability, speed and structure issues — ranked by severity with a clear fix for each.",
  },
  {
    title: "AEO — Answer Engine Optimization",
    body: "Discover the questions your audience actually asks, then shape concise answers, FAQs and FAQPage markup that answer engines can understand.",
  },
  {
    title: "GEO — Generative Engine Optimization",
    body: "Strengthen your brand entity, structured data, citations and topical clarity so search and AI systems can represent you accurately.",
  },
  {
    title: "AI Content Studio",
    body: "Generate SEO titles, outlines, articles, FAQs, internal links and schema — then review every change as a BEFORE/AFTER diff before it goes live.",
  },
  {
    title: "Social Growth Engine",
    body: "Turn one idea into platform-ready posts, hooks, high-retention video scripts, captions, hashtags and a calendar you can actually publish from.",
  },
  {
    title: "Competitor & Content Gap",
    body: "See which topics, keywords and questions competitors cover that you don't, sorted by opportunity and effort.",
  },
];

const STEPS = [
  { n: "1", t: "Enter your website", d: "Add your URL and a few business details. We verify and map your site." },
  { n: "2", t: "We crawl & audit", d: "Every page is analyzed for technical SEO, content quality, AEO and GEO readiness." },
  { n: "3", t: "Get prioritized actions", d: "Not a wall of metrics — a ranked list of the highest-value fixes with AI-drafted solutions." },
  { n: "4", t: "Implement, measure, repeat", d: "Approve changes, publish content, track results and let the loop drive what to do next." },
];

const USE_CASES = [
  ["Small business", "Fix the fundamentals fast and get found for what you sell."],
  ["SaaS & startups", "Build topical authority and turn articles into pipeline."],
  ["E-commerce", "Scale product, category and comparison content that converts."],
  ["Creators & bloggers", "Repurpose every piece into social posts and short video."],
  ["Agencies", "Run audits, actions and reports across many client sites."],
  ["Marketing teams", "One prioritized backlog connecting SEO, content and social."],
];

const PRICING = [
  {
    name: "Free",
    plan: "free",
    tagline: "See where you stand",
    features: ["1 website", "Basic crawl & audit", "Top issues and opportunities", "Limited recommendations"],
    cta: "Analyze My Website",
  },
  {
    name: "Pro",
    plan: "pro",
    tagline: "SEO + AEO + content",
    features: ["3 websites", "Full technical & on-page audit", "AEO question discovery", "AI content optimizer", "Schema & internal linking"],
    cta: "Start Pro",
    featured: true,
  },
  {
    name: "Growth",
    plan: "growth",
    tagline: "SEO + GEO + AEO + social",
    features: ["10 websites", "Everything in Pro", "GEO engine & AI visibility", "Social growth engine", "Competitor intelligence"],
    cta: "Start Growth",
  },
  {
    name: "Agency",
    plan: "agency",
    tagline: "Multi-client operations",
    features: ["Unlimited websites", "Team roles & permissions", "White-label reports", "Client dashboards", "Priority support"],
    cta: "Start Agency",
  },
];

const FAQS = [
  ["Do you guarantee #1 rankings or more traffic?", "No. No one honestly can. RankPilot optimizes the measurable factors that influence visibility and shows you what changed after you implement — the results come from your execution and the market."],
  ["Will this work with AI search like ChatGPT or Google AI?", "We improve how clearly search and AI systems can understand your brand, content and answers — entities, structure, FAQs and citations. We don't promise placement in any specific AI product."],
  ["Do you fabricate search volume or traffic numbers?", "Never. Metrics appear only when we have a reliable data source (like Google Search Console). Otherwise the interface says \"Data unavailable.\""],
  ["Is the crawl respectful of my server?", "Yes — robots.txt is honored, requests are rate-limited per host, and we use a declared user agent (RankPilotBot)."],
  ["Can I try it without connecting anything?", "Yes. Enter a URL and run a free audit — no integrations required."],
];

export default function LandingPage() {
  return (
    <main className="bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              R
            </span>
            RankPilot AI
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-ink-600 md:flex">
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <a href="#use-cases">Use cases</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost">
              Log in
            </Link>
            <Link href="/register" className="btn-primary">
              Analyze My Website
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50/70 to-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(60%_50%_at_50%_0%,rgba(37,99,235,0.14),transparent_70%)]"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
          <Reveal className="text-center lg:text-left">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700">
              SEO · AEO · GEO · Social — one growth loop
            </span>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl lg:mx-0">
              Turn Your Website Into an AI-Ready Growth Engine
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-600 lg:mx-0">
              Analyze SEO, AEO and GEO opportunities, create high-performing content, grow social
              reach and continuously improve your digital visibility.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/register" className="btn-primary px-6 py-3 text-base">
                Analyze My Website
              </Link>
              <Link href="/free-seo-audit" className="btn-secondary px-6 py-3 text-base">
                Try the free audit
              </Link>
            </div>
            <p className="mt-4 text-xs text-ink-400">
              No credit card required · We never guarantee rankings, traffic or citations — we
              optimize what you can measure.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="order-first lg:order-last">
            <FloatingHero />
          </Reveal>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Stagger className="grid gap-8 md:grid-cols-3">
          {[
            ["Metrics everywhere, answers nowhere", "Dashboards list hundreds of issues but never tell you which one matters first or what to do about it."],
            ["Search changed, tools didn't", "People now ask AI engines directly. Being crawlable is no longer the same as being understood or cited."],
            ["Content without a system", "Teams publish constantly but rarely repurpose, measure or learn — so every post starts from zero."],
          ].map(([t, d]) => (
            <StaggerItem key={t}>
              <h3 className="text-base font-semibold text-ink-900">{t}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">{d}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Modules */}
      <section id="product" className="relative border-y border-ink-100 bg-ink-50">
        <FloatingChip delay={0.4} className="right-6 top-24 hidden lg:block">
          <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-lg shadow-ink-900/10 ring-1 ring-brand-100">
            AEO ready
          </span>
        </FloatingChip>
        <FloatingChip delay={1.4} duration={6.5} className="left-6 bottom-24 hidden lg:block">
          <span className="rounded-xl bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-ink-900/20">
            GEO ↑ 21%
          </span>
        </FloatingChip>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-3xl font-bold text-ink-950">One operating system for growth</h2>
            <p className="mt-3 max-w-2xl text-ink-600">
              RankPilot connects the full loop: understand your site, prioritize opportunities,
              generate the solution, implement it, measure the result and decide what to do next.
            </p>
          </Reveal>
          <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <StaggerItem key={m.title}>
                <Tilt className="card h-full p-5">
                  <h3 className="font-semibold text-ink-900">{m.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-600">{m.body}</p>
                </Tilt>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <h2 className="text-3xl font-bold text-ink-950">How it works</h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <StaggerItem key={s.n}>
              <Tilt className="card h-full p-5" intensity={12}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-3 font-semibold text-ink-900">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink-600">{s.d}</p>
              </Tilt>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Growth loop — 3D floating cards */}
      <section className="relative overflow-hidden border-y border-ink-100 bg-gradient-to-b from-white to-brand-50/60">
        <Parallax offset={90} className="pointer-events-none absolute inset-0">
          <div className="absolute left-[6%] top-10 h-64 w-64 rounded-full bg-brand-300/30 blur-3xl" />
          <div className="absolute right-[8%] bottom-4 h-72 w-72 rounded-full bg-violet-300/30 blur-3xl" />
        </Parallax>
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <Reveal className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700">
              The growth loop
            </span>
            <h2 className="mt-4 text-3xl font-bold text-ink-950">The loop that compounds</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink-600">
              Audit, create, measure — then let the results decide what to do next. Every turn of
              the loop makes the next one cheaper.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-10 lg:grid-cols-3 lg:gap-8">
            {[
              { k: "Audit", t: "Find what matters", d: "Crawl your site and surface the highest-value issues first — not a wall of metrics.", tag: "Technical + AEO + GEO", z: 42 },
              { k: "Create", t: "Draft the fix", d: "AI writes the title, answer, schema or post, and you review the BEFORE/AFTER diff.", tag: "Content studio", z: 58 },
              { k: "Measure", t: "Prove the lift", d: "Track exactly what changed after you ship, then let the data drive the next action.", tag: "Results loop", z: 74 },
            ].map((item, index) => (
              <FloatPanel
                key={item.k}
                delay={index * 0.4}
                distance={14 + index * 4}
                duration={6.5}
                className="relative"
              >
                <div className="card p-6 pt-7">
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {item.k}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-ink-900">{item.t}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-600">{item.d}</p>
                </div>
                <Layer z={item.z} className="absolute -top-3 right-4">
                  <span className="rounded-full bg-ink-900 px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-ink-900/20">
                    {item.tag}
                  </span>
                </Layer>
              </FloatPanel>
            ))}
          </div>
        </div>

        <FloatingChip delay={0.2} className="left-4 top-1/4 hidden md:block">
          <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-lg shadow-ink-900/10 ring-1 ring-brand-100">
            +38 fixes queued
          </span>
        </FloatingChip>
        <FloatingChip delay={1.1} duration={6} className="right-5 top-1/3 hidden md:block">
          <span className="rounded-xl bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-ink-900/20">
            score 92 ↑
          </span>
        </FloatingChip>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="border-y border-ink-100 bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-3xl font-bold text-ink-950">Built for how you work</h2>
          </Reveal>
          <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map(([t, d]) => (
              <StaggerItem key={t}>
                <Tilt className="card h-full p-5">
                  <h3 className="font-semibold text-ink-900">{t}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-600">{d}</p>
                </Tilt>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <h2 className="text-3xl font-bold text-ink-950">Simple, honest pricing</h2>
          <p className="mt-3 text-ink-600">Usage-based limits. Upgrade when you outgrow a plan — never pay for vanity metrics.</p>
        </Reveal>
        <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING.map((p) => (
            <StaggerItem key={p.name}>
              <Tilt
                className={`card flex h-full flex-col p-6 ${p.featured ? "border-brand-300 ring-1 ring-brand-200" : ""}`}
                intensity={8}
              >
                <div className="text-sm font-semibold text-brand-600">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-ink-950">${PLAN_PRICES[p.plan].usd}</span>
                  <span className="text-sm text-ink-400">/mo</span>
                </div>
                <div className="mt-1 text-xs text-ink-500">{p.tagline}</div>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-600">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brand-600">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`mt-5 ${p.featured ? "btn-primary" : "btn-secondary"}`}>
                  {p.cta}
                </Link>
              </Tilt>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-6 text-sm text-ink-500">
          <Link href="/pricing" className="font-medium text-brand-700 hover:underline">
            Compare every plan limit
          </Link>{" "}
          — quotas are enforced server-side on every request.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-ink-100 bg-ink-50">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <Reveal>
            <h2 className="text-3xl font-bold text-ink-950">Honest answers</h2>
          </Reveal>
          <Stagger className="mt-8 space-y-5">
            {FAQS.map(([q, a]) => (
              <StaggerItem key={q}>
                <details className="card p-5">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-900">{q}</summary>
                  <p className="mt-2 text-sm leading-6 text-ink-600">{a}</p>
                </details>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <Reveal>
          <h2 className="text-3xl font-bold text-ink-950">Know your next best move</h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-600">
            Run a full growth audit on your website and get a prioritized action list in minutes.
          </p>
          <Link href="/register" className="btn-primary mt-6 inline-flex px-6 py-3 text-base">
            Analyze My Website
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-ink-500 sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-ink-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
              R
            </span>
            RankPilot AI
          </div>
          <div className="flex flex-wrap justify-center gap-5">
            <Link href="/free-seo-audit">Free audit</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/register">Get started</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
          </div>
          <div>© {new Date().getFullYear()} RankPilot AI</div>
        </div>
      </footer>
    </main>
  );
}
