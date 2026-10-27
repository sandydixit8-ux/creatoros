import { describe, it, expect } from "vitest";
import { calculateFees, projectMonth, formatMoney, formatPercent, ETSY_RATES } from "./etsy-fees";
import { getPost } from "./blog";

/**
 * The blog post "how-much-does-etsy-take-uk" publishes worked examples. These
 * tests pin the calculator to those numbers so the tool and the article can
 * never disagree in public.
 */
describe("etsy fees", () => {
  it("matches the blog's £20 UK worked example", () => {
    const r = calculateFees({ currency: "gbp", price: 20 });
    expect(r.listing).toBe(0.16);
    expect(r.transaction).toBe(1.3);
    expect(r.processing).toBe(1);
    expect(r.totalFees).toBe(2.46);
    expect(r.net).toBe(17.54);
    expect(formatPercent(r.effectivePct)).toBe("12.3%");
  });

  it("matches the blog's £5 UK example (fixed fees dominate)", () => {
    const r = calculateFees({ currency: "gbp", price: 5 });
    expect(r.totalFees).toBe(0.89);
    expect(formatPercent(r.effectivePct)).toBe("17.8%");
  });

  it("uses US processing rates for USD", () => {
    const r = calculateFees({ currency: "usd", price: 20 });
    expect(r.listing).toBe(0.2);
    expect(r.transaction).toBe(1.3);
    expect(r.processing).toBe(0.85);
    expect(r.totalFees).toBe(2.35);
    expect(r.net).toBe(17.65);
  });

  it("adds the Offsite Ads commission only when it fires", () => {
    const without = calculateFees({ currency: "gbp", price: 20 });
    const withAds = calculateFees({ currency: "gbp", price: 20, offsiteAds: true });
    expect(withAds.offsiteAds).toBe(3);
    expect(withAds.totalFees).toBe(5.46);
    expect(withAds.net).toBe(14.54);
    expect(withAds.totalFees).toBeGreaterThan(without.totalFees);
  });

  it("applies VAT to Etsy's fees in GBP but not in USD", () => {
    const uk = calculateFees({ currency: "gbp", price: 20, feeVat: true });
    expect(uk.feeVat).toBe(0.49);
    expect(uk.totalFees).toBe(2.95);
    expect(uk.net).toBe(17.05);

    const us = calculateFees({ currency: "usd", price: 20, feeVat: true });
    expect(us.feeVat).toBe(0);
    expect(us.totalFees).toBe(2.35);
  });

  it("charges transaction fee on shipping as well as the item", () => {
    const r = calculateFees({ currency: "gbp", price: 20, shipping: 4 });
    expect(r.gross).toBe(24);
    expect(r.transaction).toBe(1.56);
    expect(r.processing).toBe(1.16);
  });

  it("never returns negative or NaN money", () => {
    expect(calculateFees({ currency: "gbp", price: 0 }).net).toBe(0);
    expect(calculateFees({ currency: "gbp", price: -5 }).gross).toBe(0);
    expect(calculateFees({ currency: "gbp", price: Number.NaN }).totalFees).toBe(0);
    const tiny = calculateFees({ currency: "gbp", price: 1 });
    expect(tiny.net).toBeLessThan(1);
    expect(Number.isFinite(tiny.net)).toBe(true);
  });

  it("scales to a month without drifting", () => {
    const one = calculateFees({ currency: "gbp", price: 20 });
    const month = projectMonth(one, 40);
    expect(month.orders).toBe(40);
    expect(month.gross).toBe(800);
    expect(month.fees).toBe(98.4);
    expect(month.net).toBe(701.6);
    expect(projectMonth(one, -1).orders).toBe(0);
    expect(projectMonth(one, Number.NaN).orders).toBe(0);
  });

  it("compares against a self-hosted store's card fees", () => {
    const r = calculateFees({ currency: "gbp", price: 20 });
    expect(r.ownStoreFees).toBe(0.88);
    expect(r.ownStoreNet).toBe(19.12);
    expect(r.marketplaceDelta).toBe(-1.58);
  });

  it("formats money in English conventions", () => {
    expect(formatMoney(17.54, "gbp")).toBe("£17.54");
    expect(formatMoney(17.65, "usd")).toBe("$17.65");
  });

  it("keeps the rates the blog quotes in sync", () => {
    const post = getPost("how-much-does-etsy-take-uk");
    const text = JSON.stringify(post);
    expect(text).toContain("£0.16");
    expect(text).toContain("6.5%");
    expect(text).toContain("4% + £0.20");
    expect(ETSY_RATES.gbp.listing).toBe(0.16);
    expect(ETSY_RATES.gbp.transactionPct).toBe(0.065);
    expect(ETSY_RATES.gbp.processingPct).toBe(0.04);
    expect(ETSY_RATES.gbp.processingFixed).toBe(0.2);
  });
});
