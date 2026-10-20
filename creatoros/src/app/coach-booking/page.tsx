import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata = {
  title: "Online Booking for Coaches & Consultants — CreatorOS",
  description:
    "Take paid bookings as a coach or consultant without juggling a scheduler and a payment link. CreatorOS shows your availability, takes payment at booking and sends reminders — free to start, no card required.",
  alternates: { canonical: "/coach-booking" },
  openGraph: {
    title: "Online Booking for Coaches & Consultants — CreatorOS",
    description:
      "Availability, paid bookings, reminders and your store — in one branded page.",
    url: "/coach-booking",
  },
};

const FLOW = [
  { title: "Show real availability", body: "Publish your open slots and let clients pick a time in their own time zone." },
  { title: "Take payment at booking", body: "Clients pay the moment they book, so a slot is committed, not a maybe." },
  { title: "Send confirmations & reminders", body: "Confirmation and reminder emails go out automatically to cut no-shows." },
  { title: "Keep a record you can trust", body: "See who booked, what they paid and what is next — without a spreadsheet." },
];

const REASONS = [
  "Booking and payment happen in one step, so fewer clients drop off.",
  "Your bio, products and bookings live together — one journey, one brand.",
  "Paid up front plus reminders means far fewer no-shows.",
  "Turn one session into a package, a course or a recurring slot.",
];

export default function CoachBookingPage() {
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
              Coaching &amp; consulting
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Take paid bookings as a coach — without the juggling
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-secondary">
              CreatorOS shows your availability, takes payment at the moment of booking and sends reminders — all on the
              same branded page as your products and content. Start free, no card required.
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
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">A booking flow that removes every excuse to drop off</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {FLOW.map((s) => (
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
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Why coaches use CreatorOS</h2>
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
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Fill your calendar with paying clients.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-ink-secondary">
              Set up paid bookings today and stop losing clients to a clunky checkout.
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
