import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = {
  title: "Linktree Alternative for Creators — Sell, Book and Email in One Place",
  description:
    "Looking for a Linktree alternative? CreatorOS replaces your link-in-bio, store, courses, bookings, email and analytics with one all-in-one creator platform. Start free — no card required.",
  alternates: { canonical: "/linktree-alternative" },
  openGraph: {
    title: "Linktree Alternative for Creators — CreatorOS",
    description:
      "One link for your bio, products, courses and bookings — plus the analytics to see what converts. Start free.",
    url: "/linktree-alternative",
  },
};

const COMPARISON = [
  { feature: "Link-in-bio page", linktree: "Yes", creatoros: "Yes" },
  { feature: "Sell digital products", linktree: "Limited", creatoros: "Included" },
  { feature: "Online courses", linktree: "No", creatoros: "Included" },
  { feature: "Bookings & calendar", linktree: "No", creatoros: "Included" },
  { feature: "Email lists & campaigns", linktree: "No", creatoros: "Included" },
  { feature: "Leads CRM", linktree: "No", creatoros: "Included" },
  { feature: "First-party analytics", linktree: "Basic", creatoros: "Full" },
  { feature: "Community", linktree: "No", creatoros: "Included" },
  { feature: "AI growth coach", linktree: "No", creatoros: "Included" },
  { feature: "Free plan", linktree: "Yes", creatoros: "Yes" },
];

const REASONS = [
  "Stop paying for a link-in-bio tool, a store, a course platform, a scheduler and an email tool separately.",
  "One dashboard shows which content actually turns followers into leads and leads into customers.",
  "Your audience lives in your own list — not rented from an algorithm.",
  "Everything new creators need is free to start, with no card required.",
];

export default function LinktreeAlternativePage() {
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
              Linktree alternative
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              The Linktree alternative that runs your whole creator business
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-secondary">
              A link-in-bio is where your audience lands. CreatorOS is where they buy, book, subscribe and come
              back — bio page, store, courses, bookings, email and analytics in one platform.
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
          <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Why creators switch from a link-in-bio tool
            </h2>
            <ul className="mx-auto mt-10 max-w-2xl space-y-4">
              {REASONS.map((r) => (
                <li key={r} className="flex gap-3 text-ink-secondary">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">CreatorOS vs a link-in-bio tool</h2>
            <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-night-800/80 text-ink-secondary">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Capability</th>
                    <th className="px-5 py-4 font-semibold">Typical link-in-bio</th>
                    <th className="px-5 py-4 font-semibold text-brand-300">CreatorOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="bg-night-900/40">
                      <td className="px-5 py-4 text-ink">{row.feature}</td>
                      <td className="px-5 py-4 text-ink-muted">{row.linktree}</td>
                      <td className="px-5 py-4 font-medium text-ink">{row.creatoros}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-night-900/60">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Start free — no card required.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-ink-secondary">
              Build your bio page and start selling in minutes. Upgrade only when you grow.
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
