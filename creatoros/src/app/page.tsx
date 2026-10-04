import Link from "next/link";
import { ArrowRight, CalendarCheck, LineChart, Link2, Mail, Sparkles } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";

const FEATURES = [
  { icon: Link2, title: "Link-in-Bio Store", desc: "A mobile-optimized bio page for links, products, bookings & courses." },
  { icon: CalendarCheck, title: "Booking & Calendar", desc: "Let your audience book calls and sessions with smart timezone handling." },
  { icon: LineChart, title: "Audience Analytics", desc: "First-party analytics: visitors, leads, conversions, revenue, sources." },
  { icon: Mail, title: "Email & Newsletters", desc: "Capture leads and nurture with automated welcome sequences." },
  { icon: Sparkles, title: "AI Strategy Coach", desc: "Get a growth strategy, funnel and weekly plan built for your business." },
];

const PLANS = [
  { name: "Free", price: 0, tag: "Start free", features: ["1 bio page", "5 links", "10 contacts", "1 booking service", "1k views/mo", "10 AI credits"] },
  { name: "Starter", price: 9, tag: "For new creators", features: ["25 links", "500 contacts", "3 services", "10k views/mo", "50 AI credits"] },
  { name: "Creator", price: 19, tag: "Most popular", features: ["3 bio pages", "100 links", "2k contacts", "10 services", "Email automation", "200 AI credits"] },
  { name: "Pro", price: 49, tag: "For serious pros", features: ["10 bio pages", "Unlimited links & products", "10k contacts", "Unlimited services", "800 AI credits", "Email automation"] },
  { name: "Business", price: 99, tag: "For growing teams", features: ["Unlimited everything", "Unlimited courses & emails", "All Pro features", "Priority support"] },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold text-navy-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">C</span>
            <span>Creator<span className="text-brand-600">OS</span></span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-navy-600 md:flex">
            <a href="#features" className="hover:text-navy-900">Features</a>
            <a href="#pricing" className="hover:text-navy-900">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-navy-700 hover:text-navy-900">Log in</Link>
            <Link href="/auth/register" className="btn-primary">Get started free</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-navy-950 sm:text-6xl">
          Create. Grow. Sell. Automate.
          <span className="block bg-gradient-to-r from-brand-600 to-indigo-700 bg-clip-text text-transparent">All in One Place.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-navy-600">
          CreatorOS is your all-in-one operating system for turning an audience into a business — bio page, bookings, analytics and an AI growth coach.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/auth/register" className="btn-primary px-6 py-3 text-base">
            Start creating — free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/auth/login" className="btn-secondary px-6 py-3 text-base">Explore demo</Link>
        </div>
        <div className="mt-14 overflow-hidden rounded-2xl border border-navy-100 shadow-soft">
          <div className="min-h-[360px] bg-gradient-to-br from-navy-50 to-brand-50 p-8">
            <div className="mx-auto max-w-sm rounded-2xl border border-navy-100 bg-white p-6 text-left shadow-soft">
              <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-brand-500 to-indigo-700" />
              <h3 className="mt-4 text-center font-semibold text-navy-900">@democreator</h3>
              <p className="mt-1 text-center text-sm text-navy-500">Helping creators monetize their audience.</p>
              <div className="mt-5 space-y-3">
                {["Watch my free course", "Book a strategy call", "Join the community", "Read the newsletter"].map((label, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-navy-100 px-4 py-3 text-sm font-medium text-navy-800 hover:border-brand-300">
                    {label} <ArrowRight className="h-4 w-4 text-brand-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-navy-100 bg-navy-50/50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-navy-950">Everything you need to scale</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-navy-600">Nine modules. One platform. One subscription.</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-navy-900">{f.title}</h3>
                <p className="mt-1 text-sm text-navy-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-navy-950">Simple, transparent pricing</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-navy-600">Start free. Upgrade when you grow.</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {PLANS.map((p) => (
            <div key={p.name} className={`card flex flex-col p-5 ${p.name === "Creator" ? "ring-2 ring-brand-500" : ""}`}>
              <div className="text-sm font-semibold text-navy-800">{p.name}</div>
              <div className="mt-2 text-3xl font-bold text-navy-950">${p.price}<span className="text-sm font-normal text-navy-500">/mo</span></div>
              <div className="mt-1 text-xs font-medium text-brand-600">{p.tag}</div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-navy-600">
                {p.features.map((f) => <li key={f}>• {f}</li>)}
              </ul>
              <Link href="/auth/register" className={`mt-5 ${p.name === "Creator" ? "btn-primary" : "btn-secondary"} text-center`}>Choose {p.name}</Link>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}