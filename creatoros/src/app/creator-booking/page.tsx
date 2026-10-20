import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = {
  title: "Booking System for Creators & Coaches — Timezone-Aware Scheduling",
  description:
    "Take calls and sessions without paying for a separate scheduler. CreatorOS includes timezone-aware bookings, availability and request management — connected to your bio page, store and email. Start free.",
  alternates: { canonical: "/creator-booking" },
  openGraph: {
    title: "Booking System for Creators & Coaches — CreatorOS",
    description:
      "Timezone-aware bookings built into your creator platform. Share one link, manage requests and get paid.",
    url: "/creator-booking",
  },
};

const FEATURES = [
  { title: "Timezone-aware availability", desc: "Clients see open slots in their own timezone, so no more back-and-forth messages." },
  { title: "Service types", desc: "Offer discovery calls, coaching sessions or consultations — each with its own duration and price." },
  { title: "Request management", desc: "Approve, reschedule and track every booking in one clean dashboard." },
  { title: "Connected to everything", desc: "Bookings sit alongside your bio page, store, courses and email — not in a separate tool." },
];

const WHY = [
  "Stop paying for a scheduling tool on top of everything else you already run.",
  "Every booking link lives on your branded bio page, so the traffic is yours.",
  "Booked calls, leads and revenue all show up in the same analytics dashboard.",
  "Free to start — add paid services when you are ready.",
];

export default function CreatorBookingPage() {
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
              Bookings for creators
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              A booking system built into your creator platform
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-secondary">
              Let clients book calls and sessions straight from your bio page — with timezone-aware slots, approvals and
              everything else your business needs in one place.
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
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Everything scheduling should do</h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-white/10 bg-night-800/60 p-6">
                  <h3 className="font-semibold text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Why it belongs in one platform</h2>
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
              Publish your booking link today and let clients schedule themselves.
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
