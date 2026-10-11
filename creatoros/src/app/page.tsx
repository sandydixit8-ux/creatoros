import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Check,
  ChevronRight,
  GraduationCap,
  Link2,
  Mail,
  MessagesSquare,
  PenLine,
  Rocket,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { HeroProduct } from "@/components/marketing/hero-product";
import { Faq } from "@/components/marketing/faq";
import { PLAN_META, formatInr } from "@/lib/plans-meta";

export const metadata = {
  alternates: { canonical: "/" },
};

const TRUST = [
  { text: "9 modules in one workspace" },
  { text: "Free forever plan — no card required" },
  { text: "First-party analytics — no cross-site tracking" },
  { text: "Your data, exported anytime" },
];

const PROBLEMS = [
  { title: "Fragmented workflows", desc: "Links in one tool, bookings in another, store in a third. Context-switching eats your day." },
  { title: "Scattered analytics", desc: "No single view of which content turns followers into leads, and which leads into customers." },
  { title: "Disconnected monetization", desc: "Selling without an owned audience list leaves your business at the mercy of algorithms." },
];

const MODULES = [
  {
    icon: Link2,
    title: "Bio Pages",
    desc: "A mobile-optimized link-in-bio store for links, products, courses, bookings and email capture. Blocks, templates and a drag-and-drop editor.",
  },
  {
    icon: ShoppingBag,
    title: "Store & Payments",
    desc: "Sell digital products with secure checkout via Cashfree (including UPI and INR). One-time sales with receipts.",
  },
  {
    icon: GraduationCap,
    title: "Courses & Learning",
    desc: "Build courses with sections, quizzes and certificates — sell them or grant free access, and track learner progress.",
  },
  {
    icon: CalendarCheck,
    title: "Bookings & Calendar",
    desc: "Schedule calls and sessions with timezone-aware availability. Manage requests and booked slots in one place.",
  },
  {
    icon: Users,
    title: "Leads CRM",
    desc: "Capture leads from your bio with consent, then search, segment and export your audience list.",
  },
  {
    icon: Mail,
    title: "Email & Newsletters",
    desc: "Collect emails on your bio, build lists and send campaigns with unsubscribe and consent handling built in.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    desc: "First-party analytics for visits, pages, sources, devices, countries, leads and revenue.",
  },
  {
    icon: MessagesSquare,
    title: "Community",
    desc: "Grow a members community with posts, reactions and comments — owned by you, not a platform.",
  },
  {
    icon: Sparkles,
    title: "AI Strategy Coach",
    desc: "Get a scored growth analysis, funnel review and weekly plan built from your actual platform data.",
  },
];

const WORKFLOW = [
  { icon: PenLine, title: "Create", desc: "Build your bio page, store, course or services with editors and templates." },
  { icon: Rocket, title: "Publish", desc: "Go live with a QR code, templates, and your own domain on paid plans." },
  { icon: TrendingUp, title: "Grow", desc: "Capture leads with consent, build email lists and run campaigns." },
  { icon: Wallet, title: "Monetize", desc: "Sell products and courses and take bookings with secure Cashfree payments." },
  { icon: BarChart3, title: "Analyse", desc: "Track views, leads and revenue, then let the AI coach plan next week." },
];

function SectionHeading({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">{eyebrow}</p>}
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-lg text-ink-secondary">{sub}</p>}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-night-950 text-ink">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[120px]" />
            <div className="absolute top-40 -right-40 h-[380px] w-[380px] rounded-full bg-cyan-500/10 blur-[100px]" />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-24">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-ink-secondary">
              <Sparkles className="h-4 w-4 text-brand-400" aria-hidden />
              The all-in-one operating system for creator-led businesses
            </p>

            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.05]">
              Your Creator Business.
              <span className="block bg-gradient-to-r from-brand-400 via-brand-300 to-cyan-300 bg-clip-text text-transparent">
                One Powerful Workspace.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-secondary sm:text-xl">
              Plan content, grow your audience, manage partnerships, and understand your business from one connected platform.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/auth/register" className="btn-primary px-7 py-3 text-base">
                Start for Free <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/#product"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3 text-base font-medium text-ink transition-colors hover:bg-white/10"
              >
                Explore the Platform
              </Link>
            </div>
          </div>

          <div className="relative mx-auto max-w-6xl px-4 pb-6 sm:px-6">
            <HeroProduct />
            <p className="mt-10 text-center text-xs text-ink-muted">
              Illustrative sample data shown for demonstration. Connect your own account to see your real numbers.
            </p>
          </div>

          <div className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
            <ul className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map((t) => (
                <li key={t.text} className="flex items-start gap-3 text-sm text-ink-secondary">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                  {t.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="features" className="border-t border-white/10 bg-night-900/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading
              eyebrow="Why CreatorOS"
              title="Stop stitching your creator business together"
              sub="Freelancers, coaches, consultants and creators end up juggling a separate tool for everything."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {PROBLEMS.map((p) => (
                <div key={p.title} className="rounded-2xl border border-white/10 bg-night-800/60 p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                    <X className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 font-semibold text-ink">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{p.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-600/20 to-cyan-500/10 p-8 text-center">
              <p className="mx-auto max-w-2xl text-lg text-ink">
                CreatorOS unifies links, store, courses, bookings, CRM, email, community and analytics — with an AI coach
                reading the whole picture for you.
              </p>
            </div>
          </div>
        </section>

        <section id="product" className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading
              eyebrow="Product modules"
              title="Everything you need to run your creator business"
              sub="A complete, integrated workspace. Every module below is live today."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => (
                <div
                  key={m.title}
                  className="group rounded-2xl border border-white/10 bg-night-800/60 p-6 transition-colors hover:border-brand-500/40"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
                      <m.icon className="h-5 w-5" aria-hidden />
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Live
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold text-ink">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-t border-white/10 bg-night-900/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading
              eyebrow="How it fits together"
              title="From first post to repeat customers"
              sub="One connected workflow — every step maps to a module inside CreatorOS."
            />
            <ol className="mt-14 grid gap-8 md:grid-cols-5">
              {WORKFLOW.map((w, i) => (
                <li key={w.title} className="relative">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-500/30 bg-brand-500/15 text-brand-300">
                      <w.icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-ink-muted">
                      <span aria-hidden>0{i + 1}</span>
                      {i < WORKFLOW.length - 1 && (
                        <ChevronRight className="hidden h-4 w-4 text-ink-muted md:block" aria-hidden />
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold text-ink">{w.title}</h3>
                    <p className="mt-2 max-w-[200px] text-sm leading-relaxed text-ink-secondary">{w.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading
              eyebrow="Pricing"
              title="Simple, transparent pricing"
              sub="Start free. Upgrade when you grow. Cancel anytime."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {PLAN_META.map((p) => (
                <div
                  key={p.id}
                  className={`flex flex-col rounded-2xl border ${
                    p.highlight
                      ? "border-brand-500/60 bg-brand-500/10 shadow-glow"
                      : "border-white/10 bg-night-800/60"
                  } p-6`}
                >
                  <div className="text-sm font-semibold text-ink">{p.name}</div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tabular-nums text-ink">${p.usd}</span>
                    <span className="text-sm text-ink-muted">/mo</span>
                  </div>
                  <div className="mt-1 text-xs font-medium text-ink-muted">{formatInr(p.inr)} in-app</div>
                  <p className={`mt-2 text-xs font-semibold ${p.highlight ? "text-brand-300" : "text-ink-secondary"}`}>
                    {p.tag}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm text-ink-secondary">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/auth/register"
                    className={`mt-6 ${
                      p.highlight
                        ? "btn-primary justify-center"
                        : "inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-ink-muted">
              USD prices are billed via Cashfree. INR plans range from ₹749 to ₹7,499 per month and are set at checkout.
              Prices exclude payment-processing fees and applicable taxes. See the Refund Policy for the 14-day refund window.
            </p>
          </div>
        </section>

        <section id="faq" className="border-t border-white/10 bg-night-900/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading
              eyebrow="FAQ"
              title="Frequently asked questions"
              sub="Honest answers based on how the product actually works."
            />
            <div className="mt-12">
              <Faq />
            </div>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Start free — no card required.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-ink-secondary">
              Set up your workspace in minutes and publish your first creator page today.
            </p>
            <Link href="/auth/register" className="btn-primary mt-8 px-8 py-3 text-base">
              Create your free account <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}