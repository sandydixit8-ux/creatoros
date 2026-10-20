import Link from "next/link";
import { ArrowRight, BarChart3, CalendarCheck, GraduationCap, Link2, Mail, MessagesSquare, ShoppingBag, Sparkles, Users } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = {
  title: "All-in-One Creator Platform — Bio, Store, Courses, Bookings & Email",
  description:
    "CreatorOS is the all-in-one creator platform: link-in-bio, digital store, courses, bookings, email, community and analytics in one workspace. Built for creators, coaches and consultants. Start free.",
  alternates: { canonical: "/all-in-one-creator-platform" },
  openGraph: {
    title: "All-in-One Creator Platform — CreatorOS",
    description:
      "Everything a creator business needs in one workspace: bio page, store, courses, bookings, email and analytics. Start free.",
    url: "/all-in-one-creator-platform",
  },
};

const MODULES = [
  { icon: Link2, title: "Bio pages", desc: "A mobile-optimized link-in-bio store for links, products, courses, bookings and email capture." },
  { icon: ShoppingBag, title: "Digital store", desc: "Sell digital products with secure checkout and instant receipts." },
  { icon: GraduationCap, title: "Courses", desc: "Build courses with sections, quizzes and certificates, then sell or grant access." },
  { icon: CalendarCheck, title: "Bookings", desc: "Take calls and sessions with timezone-aware availability." },
  { icon: Mail, title: "Email & newsletters", desc: "Collect emails with consent, build lists and send campaigns." },
  { icon: Users, title: "Leads CRM", desc: "Capture, search, segment and export your audience list." },
  { icon: BarChart3, title: "Analytics", desc: "First-party analytics for visits, sources, leads and revenue." },
  { icon: MessagesSquare, title: "Community", desc: "Grow an owned members community with posts and comments." },
  { icon: Sparkles, title: "AI growth coach", desc: "A scored growth plan built from your actual platform data." },
];

export default function AllInOneCreatorPlatformPage() {
  return (
    <div className="min-h-screen bg-night-950 text-ink">
      <SiteHeader nav={[]} />

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[110px]" />
          </div>
          <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-ink-secondary">
              All-in-one creator platform
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              One platform for everything you create and sell
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-secondary">
              CreatorOS brings your bio page, store, courses, bookings, email, community and analytics into a single
              workspace — so you stop stitching tools together and start growing a real business.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/auth/register" className="btn-primary px-7 py-3 text-base">
                Start for Free <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3 text-base font-medium text-ink transition-colors hover:bg-white/10"
              >
                See Pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-night-900/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Every module, one login, one dashboard
            </h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => (
                <div key={m.title} className="rounded-2xl border border-white/10 bg-night-800/60 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
                    <m.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 font-semibold text-ink">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Start free — no card required.</h2>
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
