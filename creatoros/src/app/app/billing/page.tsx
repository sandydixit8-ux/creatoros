import { redirect } from "next/navigation";
import { CreditCard, XCircle } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { row } from "@/lib/db/db";
import { getLimits, PLAN_PRICES } from "@/lib/plans";
import { allUsage } from "@/lib/usage";
import { activeSubscription } from "@/lib/billing/subscriptions";
import { getPaymentProviderForCurrency, cashfreeSdkMode, billingCurrency } from "@/lib/payments";
import PlanCards, { type PlanCardData } from "./plan-cards";

export const dynamic = "force-dynamic";

const PLAN_ORDER = ["free", "starter", "creator", "pro", "business"] as const;

export default async function BillingPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const org = row<{ plan: string; name: string }>("SELECT plan, name FROM organizations WHERE id = ?", s.org.id);
  const currentPlan = org?.plan ?? "free";
  const usage = allUsage(s.org.id);
  const limits = getLimits(currentPlan);
  const sub = activeSubscription(s.org.id);
  const currency = billingCurrency();
  // Derive both from the provider that will actually settle this currency rather
  // than from PAYMENT_PROVIDER. The env-based check disagreed with the server
  // whenever the preferred provider could not handle BILLING_CURRENCY: the page
  // rendered an Indian 10-digit phone field and live Upgrade buttons for a
  // currency no configured gateway could charge.
  const billingProvider = getPaymentProviderForCurrency(currency);
  const paymentsWired = billingProvider.isConfigured();
  const isMock = sub?.provider === "mock";
  // Cashfree mandates require an Indian phone, so ask for it at checkout.
  const sdkMode = cashfreeSdkMode();
  const needsPhone = paymentsWired && billingProvider.requiresCustomerPhone;
  const showPriceInr = currency === "inr" && PLAN_PRICES.starter.inr > 0;

  const contactCount = (row("SELECT COUNT(*) AS c FROM contacts WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;
  const pageCount = (row("SELECT COUNT(*) AS c FROM bio_pages WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;
  const serviceCount = (row("SELECT COUNT(*) AS c FROM services WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;
  const productCount = (row("SELECT COUNT(*) AS c FROM products WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;
  const courseCount = (row("SELECT COUNT(*) AS c FROM courses WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;

  const meters = [
    { label: "Bio pages", used: pageCount, limit: limits.bioPages },
    { label: "Contacts", used: Math.max(contactCount, usage.contacts || 0), limit: limits.contacts },
    { label: "Bookings services", used: serviceCount, limit: limits.services },
    { label: "Products", used: productCount, limit: limits.products },
    { label: "Courses", used: courseCount, limit: limits.courses },
    { label: "AI credits", used: usage.aiCredits || 0, limit: limits.aiCredits },
    { label: "Emails sent", used: usage.emails || 0, limit: limits.emailsPerMonth },
    { label: "Views / month", used: usage.viewsPerMonth || 0, limit: limits.viewsPerMonth },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Billing &amp; plan</h1>
        <p className="mt-1 text-sm text-navy-500">You&apos;re on the <span className="font-medium capitalize text-navy-900">{currentPlan}</span> plan.</p>
      </div>

      {sub && (
        <div className={`card flex flex-wrap items-center justify-between gap-4 p-5 ${isMock ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50"}`}>
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-navy-400" />
            <div>
              <div className="font-semibold capitalize text-navy-900">{sub.plan} plan · {sub.status}</div>
              <div className="text-xs text-navy-500">
                via {sub.provider}
                {sub.current_period_end && <> · next charge {sub.current_period_end.slice(0, 10)}</>}
                {isMock && <> · simulated (no payment provider keys)</>}
              </div>
            </div>
          </div>
          <form method="POST" action="/api/billing/cancel">
            <button type="submit" className="btn-secondary !py-2 text-sm text-red-600">
              <XCircle className="h-4 w-4" /> Cancel subscription
            </button>
          </form>
        </div>
      )}

      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-navy-900">Usage this month</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meters.map((m) => {
            const pct = m.limit === -1 ? 0 : Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
            const nearly = m.limit !== -1 && pct >= 80;
            return (
              <div key={m.label} className="rounded-xl border border-navy-100 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-navy-700">{m.label}</span>
                  <span className="text-navy-400">
                    {m.used}{m.limit !== -1 ? ` / ${m.limit}` : " / ∞"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-100">
                  <div
                    className={`h-full rounded-full ${nearly ? "bg-amber-500" : "bg-brand-500"}`}
                    style={{ width: `${m.limit === -1 ? 0 : pct}%` }}
                  />
                </div>
                {nearly && <p className="mt-1 text-xs text-amber-600">Upgrade for headroom</p>}
              </div>
            );
          })}
        </div>
      </div>

      <PlanCards
        plans={PLAN_ORDER.map((key) => {
          const l = getLimits(key);
          return {
            key,
            active: key === currentPlan,
            priceInr: PLAN_PRICES[key].inr,
            priceUsd: PLAN_PRICES[key].usd,
            limits: {
              bioPages: l.bioPages,
              links: l.links,
              contacts: l.contacts,
              services: l.services,
              customDomain: l.customDomain,
              emailAutomation: l.emailAutomation,
            },
          } satisfies PlanCardData;
        })}
        mode={sdkMode}
        needsPhone={needsPhone}
        showPriceInr={showPriceInr}
      />

      <p className="text-center text-xs text-navy-400">
        {paymentsWired
          ? `Plan upgrades are billed in ${showPriceInr ? "INR" : "USD"} through the payment provider and applied via webhook.`
          : "Billing activates once payment provider keys are set. Upgrades are simulated for development until then."}
      </p>
    </div>
  );
}
