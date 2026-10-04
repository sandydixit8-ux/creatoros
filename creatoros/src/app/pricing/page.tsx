import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";

const PLANS = [
  { name: "Free", price: 0, tag: "Start free", features: ["1 bio page", "5 links", "10 contacts", "1 booking service", "1k views/mo", "10 AI credits"] },
  { name: "Starter", price: 9, tag: "For new creators", features: ["25 links", "500 contacts", "3 services", "10k views/mo", "50 AI credits"] },
  { name: "Creator", price: 19, tag: "Most popular", features: ["3 bio pages", "100 links", "2k contacts", "10 services", "Email automation", "200 AI credits"] },
  { name: "Pro", price: 49, tag: "For serious pros", features: ["10 bio pages", "Unlimited links & products", "10k contacts", "Unlimited services", "800 AI credits", "Email automation"] },
  { name: "Business", price: 99, tag: "For growing teams", features: ["Unlimited everything", "Unlimited courses & emails", "All Pro features", "Priority support"] },
];

export const metadata = {
  title: "Pricing — CreatorOS",
  description: "Simple, transparent pricing for creators. Start free, upgrade when you grow.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-navy-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">C</span>
            <span>Creator<span className="text-brand-600">OS</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-navy-700 hover:text-navy-900">Log in</Link>
            <Link href="/auth/register" className="btn-primary">Get started free</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h1 className="text-center text-4xl font-bold tracking-tight text-navy-950">Simple, transparent pricing</h1>
        <p className="mx-auto mt-3 max-w-lg text-center text-navy-600">Start free. Upgrade when you grow. Cancel anytime.</p>

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

        <p className="mt-12 text-center text-sm text-navy-500">
          Have questions?{" "}
          <Link href="/auth/register" className="font-medium text-brand-600 hover:underline">Start free</Link> and reach out from your dashboard.
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}