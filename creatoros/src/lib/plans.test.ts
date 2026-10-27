import { describe, it, expect } from "vitest";
import { getLimits, withinLimit, PLANS, planPriceFor } from "./plans";
import { formatByCurrency, formatInr, planPriceDisplay, PLAN_META } from "./plans-meta";

describe("plans", () => {
  it("falls back to free for unknown plans", () => {
    expect(getLimits("nonexistent")).toBe(PLANS.free);
    expect(getLimits(undefined as unknown as string)).toBe(PLANS.free);
  });

  it("escalates limits across tiers", () => {
    const free = getLimits("free");
    const business = getLimits("business");
    expect(free.contacts).toBeLessThan(getLimits("starter").contacts);
    expect(getLimits("creator").customDomain).toBe(true);
    expect(business.contacts).toBe(-1);
  });

  it("treats -1 as unlimited in withinLimit", () => {
    expect(withinLimit(999999, -1)).toBe(true);
    expect(withinLimit(9, 10)).toBe(true);
    expect(withinLimit(10, 10)).toBe(false);
  });
});

describe("plan pricing by currency", () => {
  it("prices each plan in its own currency, never a converted guess", () => {
    expect(planPriceFor("inr", "starter")).toBe(749);
    expect(planPriceFor("INR", "business")).toBe(7499);
    expect(planPriceFor("usd", "starter")).toBe(9);
    // GBP has a delegated price of its own (not USD relabelled).
    expect(planPriceFor("gbp", "starter")).toBe(7);
    expect(planPriceFor("GBP", "business")).toBe(79);
    // EUR has no delegated price yet; it must never charge a guess.
    expect(planPriceFor("eur", "starter")).toBe(9);
    expect(planPriceFor("unknown", "creator")).toBe(19);
    expect(planPriceFor("inr", "nonexistent")).toBe(0);
  });
});

describe("currency formatting", () => {
  it("formats each currency with its own symbol and group separators", () => {
    expect(formatInr(0)).toBe("₹0");
    expect(formatInr(7499)).toBe("₹7,499");
    expect(formatByCurrency("inr", 1599)).toBe("₹1,599");
    expect(formatByCurrency("usd", 99)).toBe("$99");
    expect(formatByCurrency("gbp", 0)).toBe("£0");
    expect(formatByCurrency("gbp", 7)).toBe("£7");
    expect(formatByCurrency("eur", 42)).toBe("€42");
    expect(formatByCurrency("unknown", 5)).toBe("$5");
  });
});

describe("headline price by visitor country", () => {
  const creator = PLAN_META.find((p) => p.id === "creator")!;
  const free = PLAN_META.find((p) => p.id === "free")!;

  it("shows the pinned GBP price a UK visitor is charged", () => {
    const d = planPriceDisplay(creator, "GB");
    expect([d.currency, d.symbol, d.amount]).toEqual(["gbp", "£", 15]);
    expect(d.secondary).toBe("$19 in the US · ₹1,599 in India");
  });

  it("keeps USD as the headline everywhere else", () => {
    for (const country of ["US", "IN", "", undefined, null, "gb"]) {
      const d = planPriceDisplay(creator, country as string);
      if (country === "gb") {
        expect(d.symbol).toBe("£");
        continue;
      }
      expect([d.currency, d.symbol, d.amount]).toEqual(["usd", "$", 19]);
      expect(d.secondary).toBe("£15 in the UK · ₹1,599 in India");
    }
  });

  it("treats free as free in every currency", () => {
    expect(planPriceDisplay(free, "GB").secondary).toBe("Free forever");
    expect(planPriceDisplay(free, "US").amount).toBe(0);
  });

  it("never invents a price: every plan keeps its own GBP figure", () => {
    for (const p of PLAN_META) {
      const d = planPriceDisplay(p, "GB");
      expect(d.amount).toBe(p.gbp);
    }
  });
});