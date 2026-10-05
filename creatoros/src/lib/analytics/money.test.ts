import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, nowIso } from "@/lib/db/db";
import { mrrByCurrency, revenueSnapshot, revenueMonthlySeries, lastChargeAt } from "./money";
import { formatMoneyCents, formatMoneyBreakdown } from "@/lib/money-format";

let dir: string;
const TENANT = "org_money_test";
const INR_TENANT = "org_money_inr";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-money-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Money', 'money-org', 'free', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'MoneyINR', 'money-org-inr', 'free', ?, ?)", INR_TENANT, nowIso(), nowIso());

  // Currency is recorded per subscription, so an INR mandate is not costed in USD.
  run("INSERT INTO subscriptions (id, tenant_id, status, plan, currency, created_at, updated_at) VALUES ('sub1', ?, 'active', 'pro', 'usd', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO subscriptions (id, tenant_id, status, plan, currency, created_at, updated_at) VALUES ('sub2', ?, 'active', 'starter', 'usd', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO subscriptions (id, tenant_id, status, plan, currency, created_at, updated_at) VALUES ('sub3', ?, 'canceled', 'creator', 'usd', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO subscriptions (id, tenant_id, status, plan, currency, created_at, updated_at) VALUES ('subinr', ?, 'active', 'starter', 'inr', ?, ?)", INR_TENANT, nowIso(), nowIso());

  run("INSERT INTO payments (id, tenant_id, amount_cents, currency, status, created_at) VALUES ('pay1', ?, 4900, 'usd', 'succeeded', ?)", TENANT, nowIso());
  run("INSERT INTO payments (id, tenant_id, amount_cents, currency, status, created_at) VALUES ('pay2', ?, 1900, 'usd', 'succeeded', ?)", TENANT, nowIso());
  run("INSERT INTO payments (id, tenant_id, amount_cents, currency, status, created_at) VALUES ('pay3', ?, 5000, 'usd', 'failed', ?)", TENANT, nowIso());

  // Same tenant, same month, rupee revenue: the two currencies must not be added.
  run("INSERT INTO payments (id, tenant_id, amount_cents, currency, status, created_at) VALUES ('payinr', ?, 74900, 'inr', 'succeeded', ?)", TENANT, nowIso());
  run("INSERT INTO payments (id, tenant_id, amount_cents, currency, status, created_at) VALUES ('payinr2', ?, 74900, 'inr', 'succeeded', ?)", INR_TENANT, nowIso());
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("revenue analytics", () => {
  it("computes MRR per currency, not as a blended total", () => {
    expect(mrrByCurrency(TENANT)).toEqual([{ currency: "usd", cents: 4900 + 900 }]);
  });

  it("values an INR subscription at its INR list price", () => {
    expect(mrrByCurrency(INR_TENANT)).toEqual([{ currency: "inr", cents: 74900 }]);
  });

  it("keeps succeeded payments in separate currency buckets", () => {
    const snap = revenueSnapshot(TENANT, 30);
    // 4900 + 1900 usd, 74900 inr. Adding these would be meaningless.
    expect(snap.lifeTime).toEqual([
      { currency: "inr", cents: 74900 },
      { currency: "usd", cents: 6800 },
    ]);
    expect(snap.period).toEqual(snap.lifeTime);
    expect(snap.subscriptionsActive).toBe(2);
    const recurring = snap.sources.find((s) => s.label.startsWith("Recurring"));
    expect(recurring?.byCurrency).toEqual([{ currency: "usd", cents: 5800 }]);
  });

  it("does not leak another tenant's revenue", () => {
    const snap = revenueSnapshot(INR_TENANT, 30);
    expect(snap.lifeTime).toEqual([{ currency: "inr", cents: 74900 }]);
  });

  it("builds a zero-filled series with per-currency months", () => {
    const series = revenueMonthlySeries(TENANT, 6);
    expect(series.length).toBe(6);
    const last = series[series.length - 1];
    expect(last.byCurrency).toEqual([
      { currency: "inr", cents: 74900 },
      { currency: "usd", cents: 6800 },
    ]);
    expect(series.slice(0, 5).every((m) => m.scale === 0)).toBe(true);
  });

  it("reports the last successful charge", () => {
    expect(lastChargeAt(TENANT)).not.toBeNull();
    expect(lastChargeAt("missing-tenant")).toBeNull();
  });
});

describe("money formatting", () => {
  it("formats a single currency without inventing another", () => {
    expect(formatMoneyCents(123456, "usd")).toBe("$1,234.56");
    expect(formatMoneyCents(123456, "inr")).toBe("₹1,234.56");
  });

  it("renders a multi-currency total as separate figures", () => {
    const rendered = formatMoneyBreakdown([
      { currency: "usd", cents: 123456 },
      { currency: "inr", cents: 50000000 },
    ]);
    expect(rendered).toBe("$1,234.56 · ₹5,00,000.00");
    // The old implementation multiplied by a hardcoded 84 and printed a
    // rupee figure for dollar input. That must never come back.
    expect(rendered).not.toContain("1,03,703");
  });

  it("defaults an unknown currency to USD rather than throwing", () => {
    expect(formatMoneyCents(1000, "xyz" as string)).toBe("$10.00");
  });
});
