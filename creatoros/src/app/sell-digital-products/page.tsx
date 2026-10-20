import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = {
  title: "How to Sell Digital Products as a Creator — Store, Checkout & Receipts",
  description:
    "Sell digital products without a developer. CreatorOS gives creators a hosted store, secure checkout, instant receipts and the analytics to see what sells — all connected to your bio page. Start free.",
  alternates: { canonical: "/sell-digital-products" },
  openGraph: {
    title: "Sell Digital Products as a Creator — CreatorOS",
    description:
      "A hosted store for creators: upload a product, share one link, get paid. Secure checkout and instant receipts included.",
    url: "/sell-digital-products",
  },
};

const STEPS = [
  { title: "Create your free account", desc: "No card required. Your workspace and bio page are ready in minutes." },
  { title: "Add a product", desc: "Upload a file and set a price. Courses, templates, presets, guides — anything digital." },
  { title: "Share one link", desc: "Send followers to your bio page. They browse, buy and download without leaving your brand." },
  { title: "Get paid with receipts", desc: "Secure checkout with instant receipts sent to every buyer." },
  { title: "Track what sells", desc: "First-party analytics show visits, sources, leads and revenue in one place." },
];

const WHY = [
  "Your store lives on your own branded bio page — not buried inside someone else's marketplace.",
  "Payments and receipts are handled for you, so you never touch card data.",
  "Buyers, leads and analytics all flow into the same workspace as your content and email.",
  "Start free and upgrade only when your sales grow.",
];

export default function SellDigitalProductsPage() {
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
              Sell digital products
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Sell digital products as a creator — no developer required
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-secondary">
              Upload a product, share one link and get paid. CreatorOS handles the store, secure checkout, receipts and
              analytics so you can focus on creating.
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
          <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">From upload to paid in five steps</h2>
            <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-white/10 bg-night-800/60 p-6">
                  <span className="text-sm font-semibold text-brand-300">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Why creators sell on CreatorOS</h2>
            <ul className="mx-auto mt-10 max-w-2xl space-y-4">
              {WHY.map((w) => (
                <li key={w} className="flex gap-3 text-ink-secondary">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-white/10 bg-night-900/60">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Start free — no card required.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-ink-secondary">
              List your first digital product today and share it with your audience.
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
