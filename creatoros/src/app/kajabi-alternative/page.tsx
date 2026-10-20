import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = {
  title: "Kajabi Alternative for Creators — Courses, Store & Email in One Place",
  description:
    "A simpler, more affordable Kajabi alternative. CreatorOS gives creators courses, a digital store, bookings, email, community and analytics in one workspace — free to start, no card required.",
  alternates: { canonical: "/kajabi-alternative" },
  openGraph: {
    title: "Kajabi Alternative for Creators — CreatorOS",
    description:
      "Courses, store, bookings, email and analytics in one platform. Start free and upgrade when you grow.",
    url: "/kajabi-alternative",
  },
};

const COMPARISON = [
  { feature: "Online courses", kajabi: "Yes", creatoros: "Yes" },
  { feature: "Digital product store", kajabi: "Yes", creatoros: "Yes" },
  { feature: "Link-in-bio page", kajabi: "Limited", creatoros: "Included" },
  { feature: "Bookings & calendar", kajabi: "Add-on", creatoros: "Included" },
  { feature: "Email lists & campaigns", kajabi: "Yes", creatoros: "Included" },
  { feature: "Leads CRM", kajabi: "Basic", creatoros: "Included" },
  { feature: "Community", kajabi: "Add-on", creatoros: "Included" },
  { feature: "First-party analytics", kajabi: "Yes", creatoros: "Full" },
  { feature: "AI growth coach", kajabi: "No", creatoros: "Included" },
  { feature: "Free plan", kajabi: "No", creatoros: "Yes" },
];

const REASONS = [
  "Get started free — no card required — and only pay when your business grows.",
  "Run courses, a store, bookings, email and community without stacking subscriptions.",
  "Launch from a branded bio page that keeps every visit and lead on your side.",
  "One analytics view connects your content, leads and revenue.",
];

export default function KajabiAlternativePage() {
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
              Kajabi alternative
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              A simpler, more affordable Kajabi alternative
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-secondary">
              CreatorOS gives you courses, a store, bookings, email, community and analytics in one workspace — and you
              can start free, without a card.
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
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Why creators look for an alternative</h2>
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
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">CreatorOS vs a course platform</h2>
            <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-night-800/80 text-ink-secondary">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Capability</th>
                    <th className="px-5 py-4 font-semibold">Typical course platform</th>
                    <th className="px-5 py-4 font-semibold text-brand-300">CreatorOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="bg-night-900/40">
                      <td className="px-5 py-4 text-ink">{row.feature}</td>
                      <td className="px-5 py-4 text-ink-muted">{row.kajabi}</td>
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
              Build your first course or product today and only upgrade when you grow.
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
