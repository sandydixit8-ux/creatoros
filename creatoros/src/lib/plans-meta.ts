export interface PlanMeta {
  id: string;
  name: string;
  tag: string;
  usd: number;
  inr: number;
  gbp: number;
  highlight?: boolean;
  cta: string;
  features: string[];
}

export const PLAN_META: PlanMeta[] = [
  {
    id: "free",
    name: "Free",
    tag: "Start free, no card required",
  usd: 0,
  inr: 0,
  gbp: 0,
    cta: "Start for Free",
    features: [
      "1 bio page · 5 links · 10 contacts",
      "1 booking service · 5 products · 1 course",
      "1,000 views/mo · 10 AI credits · 100 emails/mo",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    tag: "For new creators",
  usd: 9,
  inr: 749,
  gbp: 7,
    cta: "Choose Starter",
    features: [
      "25 links · 500 contacts · 3 services",
      "25 products · 3 courses",
      "10,000 views/mo · 50 AI credits · 1,000 emails/mo",
    ],
  },
  {
    id: "creator",
    name: "Creator",
    tag: "Most popular",
  usd: 19,
  inr: 1599,
  gbp: 15,
    highlight: true,
    cta: "Choose Creator",
    features: [
      "3 bio pages · 100 links · 2,000 contacts",
      "10 services · 100 products · 10 courses",
      "50,000 views/mo · 200 AI credits · 5,000 emails/mo",
      "Custom domain + email automation",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tag: "For serious pros",
  usd: 49,
  inr: 3499,
  gbp: 39,
    cta: "Choose Pro",
    features: [
      "10 bio pages · unlimited links, products & services",
      "10,000 contacts · 50 courses",
      "250,000 views/mo · 800 AI credits · 20,000 emails/mo",
      "Custom domain + email automation",
    ],
  },
  {
    id: "business",
    name: "Business",
    tag: "For growing teams",
  usd: 99,
  inr: 7499,
  gbp: 79,
    cta: "Choose Business",
    features: [
      "Unlimited everything",
      "Unlimited courses & emails",
      "Unlimited AI credits · custom domain + automation",
      "Hands-on onboarding support",
    ],
  },
];

export function formatInr(price: number): string {
  return price === 0 ? "₹0" : `₹${price.toLocaleString("en-IN")}`;
}

/** Localised whole-currency price with the right symbol. USD is the fallback
 * for any currency without a dedicated format (e.g. future GBP/EUR entries). */
export function formatByCurrency(currency: string, price: number): string {
  switch ((currency || "").toLowerCase()) {
    case "inr":
      return formatInr(price);
    case "gbp":
      return price === 0 ? "£0" : `£${price.toLocaleString("en-GB")}`;
    case "eur":
      return price === 0 ? "€0" : `€${price.toLocaleString("de-DE")}`;
    default:
      return price === 0 ? "$0" : `$${price.toLocaleString("en-US")}`;
  }
}

export interface PlanPriceDisplay {
  currency: "usd" | "gbp";
  symbol: "$" | "£";
  amount: number;
  /** The same plan in the other currencies, shown under the headline price. */
  secondary: string;
}

/**
 * Headline price for a visitor. UK visitors see the pinned GBP price they will
 * actually be charged at checkout (the products are tax-inclusive and carry a
 * local GBP price); everyone else sees the USD list price. Free stays free.
 */
export function planPriceDisplay(plan: PlanMeta, country?: string | null): PlanPriceDisplay {
  if (plan.usd === 0) {
    return { currency: "usd", symbol: "$", amount: 0, secondary: "Free forever" };
  }

  if ((country || "").toUpperCase() === "GB") {
    return {
      currency: "gbp",
      symbol: "£",
      amount: plan.gbp,
      secondary: `$${plan.usd} in the US · ${formatInr(plan.inr)} in India`,
    };
  }

  return {
    currency: "usd",
    symbol: "$",
    amount: plan.usd,
    secondary: `£${plan.gbp} in the UK · ${formatInr(plan.inr)} in India`,
  };
}