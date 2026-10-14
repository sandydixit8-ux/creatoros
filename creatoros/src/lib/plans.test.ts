import { describe, it, expect } from "vitest";
import { getLimits, withinLimit, PLANS, planPriceFor } from "./plans";
import { formatByCurrency, formatInr } from "./plans-meta";

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