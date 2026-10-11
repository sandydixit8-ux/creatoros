import Link from "next/link";
import { Check } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Faq } from "@/components/marketing/faq";
import { PLAN_META, formatInr } from "@/lib/plans-meta";

export const metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for creators. Start free, upgrade when you grow. Cancel anytime.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-night-950 text-ink">
      <SiteHeader nav={[]} />

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[110px]" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-24">
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-ink-secondary">
              Start free. Upgrade when you grow. Cancel anytime.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {PLAN_META.map((p) => (
              <div
                key={p.id}
                className={`flex flex-col rounded-2xl border ${
                  p.highlight ? "border-brand-500/60 bg-brand-500/10 shadow-glow" : "border-white/10 bg-night-800/60"
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

          <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-ink-muted">
            USD prices are billed via Cashfree. INR plans range from ₹749 to ₹7,499 per month and are set at checkout.
            Prices exclude payment-processing fees and applicable taxes. See the Refund Policy for the 14-day refund window.
          </p>
        </section>

        <section id="faq" className="border-t border-white/10 bg-night-900/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Frequently asked questions
            </h2>
            <div className="mt-12">
              <Faq />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}