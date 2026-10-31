import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import EtsyFeeCalculator from "@/components/tools/etsy-fee-calculator";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Etsy Fee Calculator UK & US (2026) — What You Actually Keep",
  description:
    "Free Etsy fee calculator for UK and US sellers. See the listing fee, 6.5% transaction fee, payment processing, the UK Regulatory Operating Fee and Offsite Ads taken from any sale, plus what you keep per order and per month.",
  alternates: { canonical: "/etsy-fee-calculator" },
  openGraph: {
    title: "Etsy Fee Calculator UK & US (2026)",
    description:
      "Work out exactly what Etsy takes from a sale: listing fee, transaction fee, processing and Offsite Ads — in pounds or dollars.",
    url: "/etsy-fee-calculator",
  },
};

const FAQ = [
  {
    q: "How much does Etsy take from a UK sale in 2026?",
    a: "Etsy charges four fees on a normal UK order: a £0.16 listing fee, a 6.5% transaction fee on the item price plus shipping, payment processing of 4% + £0.20, and the 0.48% Regulatory Operating Fee. On a £20 digital download that is £2.56, or 12.8% of the sale, before any advertising.",
  },
  {
    q: "Does the calculator work for digital downloads?",
    a: "Yes. Set shipping to zero and leave Offsite Ads unticked unless the sale came from an Etsy ad. Digital listings still pay the £0.16 listing fee, and Etsy charges it again every four months while the listing auto-renews.",
  },
  {
    q: "Do I pay VAT on Etsy's fees in the UK?",
    a: "Etsy adds 20% VAT to its own fees for UK sellers, which is why the fee total on your statement can look higher than the percentages suggest. Tick \"Include VAT on Etsy's fees\" to see that effect. It is a tax on Etsy's charges, not extra Etsy margin, and it does not apply to your item price.",
  },
  {
    q: "How much is the Offsite Ads fee?",
    a: "15% of the order total when an off-site ad brings the buyer, or 12% for sellers who have made more than $10,000 on Etsy in the past 365 days. The commission applies to the whole order, including shipping, and only to sales Etsy attributes to an ad.",
  },
  {
    q: "Why do cheap products lose such a high percentage?",
    a: "Two of Etsy's fees are fixed: the £0.16 listing fee and the £0.20 processing charge. On a £5 download they add up to £0.91, which is 18.2%, because the fixed part does not shrink with the price. Bundling several files into one listing, and pricing at £15 or above, brings the effective rate down quickly.",
  },
  {
    q: "Is it cheaper to sell on my own store?",
    a: "Per sale, usually yes — a self-hosted store pays card processing of roughly 1.5% + 20p for UK cards (2.9% + 30¢ for US cards) and no transaction fee. The catch is discovery: Etsy's fees buy you buyers you would otherwise have to find yourself. Most UK sellers run both for a quarter and compare, rather than switching on fees alone.",
  },
  {
    q: "Does Etsy charge a fee on shipping?",
    a: "Yes. The 6.5% transaction fee applies to the item price, the shipping you charge and any gift wrap. Payment processing applies to the order total as well, which is why free shipping is not actually free on Etsy.",
  },
];

export default function EtsyFeeCalculatorPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Etsy Fee Calculator (UK & US)",
    url: `${SITE_URL}/etsy-fee-calculator`,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    description:
      "Calculate the listing fee, 6.5% transaction fee, payment processing, UK Regulatory Operating Fee and Offsite Ads Etsy takes from a UK or US sale.",
  };

  return (
    <div className="min-h-screen bg-night-950 text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }} />
      <SiteHeader nav={[]} />

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[110px]" />
          </div>
          <div className="relative mx-auto max-w-3xl px-4 pt-16 text-center sm:px-6 sm:pt-20">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-ink-secondary">
              Free tool · UK &amp; US
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Etsy fee calculator
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-secondary">
              Etsy never charges one fee. Enter a price to see the listing fee, the 6.5% transaction fee, payment
              processing, the UK Regulatory Operating Fee and Offsite Ads — and what actually lands in your account.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <EtsyFeeCalculator />
        </section>

        <section className="border-t border-white/10 bg-night-900/60">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">How Etsy&apos;s fees stack up</h2>
            <div className="mt-6 space-y-4 text-ink-secondary">
              <p className="leading-relaxed">
                A UK order pays four separate charges. The listing fee is flat and charged every time a listing is
                published or auto-renews — every four months, sold or not. The transaction fee is 6.5% of the item
                price, shipping and gift wrap. Payment processing is 4% + £0.20 for UK sellers on Etsy Payments, and
                3% + $0.25 for US sellers. On top of those, UK sellers pay a 0.48% Regulatory Operating Fee on the
                same item-plus-shipping base, with VAT added where applicable.
              </p>
              <p className="leading-relaxed">
                Because two of those are fixed, the effective rate depends almost entirely on your price point. A
                £20 download loses about 12.8%. A £5 download loses about 18.2% for the same fees. That is the single
                most useful number on this page: not the percentage Etsy advertises, but the percentage your own price
                list produces.
              </p>
              <p className="leading-relaxed">
                Offsite Ads is the fee that surprises people most. When an Etsy ad on Google, Facebook or Instagram
                brings the buyer, Etsy takes 15% of the entire order on top of everything else — and the commission
                applies to repeat purchases from that buyer for a year. Sellers under $10,000 a year can opt out; above
                that it is mandatory.
              </p>
            </div>

            <div className="mt-10 rounded-2xl border border-white/10 bg-night-800/60 p-6 sm:p-7">
              <h2 className="text-lg font-semibold text-ink">Run the numbers for your own shop</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                The full UK breakdown, including which fees you can avoid, is in our guide. If you are weighing a move,
                the fee comparison against Payhip and Gumroad uses the same maths as this calculator.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  { label: "How much does Etsy take from a UK sale? (full breakdown)", href: "/blog/how-much-does-etsy-take-uk" },
                  { label: "Payhip vs Gumroad fees for UK creators", href: "/blog/payhip-vs-gumroad-fees-uk" },
                  { label: "The best Etsy alternative for UK creators", href: "/blog/etsy-alternative-for-uk-creators" },
                  { label: "How to sell digital products in the UK", href: "/blog/how-to-sell-digital-products-uk" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-2 rounded-lg text-sm text-brand-300 underline-offset-4 transition-colors hover:text-brand-200 hover:underline"
                    >
                      {link.label}
                      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Etsy fee questions</h2>
            <dl className="mt-8 space-y-8">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt className="text-base font-semibold text-ink">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ink-secondary">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t border-white/10 bg-night-900/60">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-ink">Keep more of every sale</h2>
            <p className="mx-auto mt-3 max-w-xl text-ink-secondary">
              CreatorOS gives you a store, checkout, email list and analytics on your own link — free to start, no card
              required.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/auth/register" className="btn-primary px-7 py-3 text-base">
                Start for Free <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3 text-base font-medium text-ink transition-colors hover:bg-white/10"
              >
                See pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
