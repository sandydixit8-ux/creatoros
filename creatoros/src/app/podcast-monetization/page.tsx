import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = {
  title: "Podcast Monetization for Creators — Memberships, Products & Bookings",
  description:
    "Turn podcast listeners into paying customers. CreatorOS gives podcasters memberships, a digital store, bookings, email and analytics in one branded page — free to start, no card required.",
  alternates: { canonical: "/podcast-monetization" },
  openGraph: {
    title: "Podcast Monetization for Creators — CreatorOS",
    description:
      "Memberships, digital products, bookings, email and analytics for podcasters — in one platform.",
    url: "/podcast-monetization",
  },
};

const STREAMS = [
  { title: "Paid memberships", body: "Give superfans a bonus feed, early episodes or a private community for a recurring fee." },
  { title: "Digital products", body: "Sell transcripts, guides, presets and templates straight from your show page." },
  { title: "A course from your episodes", body: "Package your best episodes into a structured course your audience can buy." },
  { title: "Paid bookings", body: "Take paid coaching or consulting calls with built-in availability and checkout." },
  { title: "Email list", body: "Capture listeners with a free bonus episode and sell to them when you launch." },
  { title: "First-party analytics", body: "See which episode, link and call to action actually produced revenue." },
];

const REASONS = [
  "Every episode points to one branded page — subscribe, buy, book or join your list.",
  "Sponsors are optional; you can earn from listeners you already have.",
  "Own the email list and customer data, not the platform's.",
  "Start free — no card required — and upgrade only when you grow.",
];

export default function PodcastMonetizationPage() {
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
              Podcast monetization
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Monetize your podcast without waiting for a sponsor
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-secondary">
              CreatorOS turns listeners into customers with memberships, digital products, bookings and email — all on
              one branded page. Start free, no card required.
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
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Income streams that do not need a sponsor</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {STREAMS.map((s) => (
                <div key={s.title} className="rounded-2xl border border-white/10 bg-night-900/40 p-6">
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-ink-secondary">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Why podcasters switch to CreatorOS</h2>
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

        <section className="border-t border-white/10 bg-night-900/60">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Give every episode a destination.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-ink-secondary">
              Build your podcast page today and start earning from the audience you already have.
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
