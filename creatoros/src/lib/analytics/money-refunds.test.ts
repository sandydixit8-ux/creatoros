import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, nowIso } from "@/lib/db/db";
import { revenueSnapshot, mrrMovement, revenueMonthlySeries } from "./money";

let dir: string;
const TENANT = "org_refund_test";
const OTHER = "org_refund_other";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-refund-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  for (const [id, slug] of [[TENANT, "refund-org"], [OTHER, "refund-other"]] as const) {
    run(
      "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)",
      id,
      id,
      slug,
      nowIso(),
      nowIso()
    );
  }
  const t = nowIso();

  // A clean store sale: the order AND its settling payment row exist. Counting
  // both is what used to double every store sale in the report.
  run("INSERT INTO orders (id, tenant_id, email, status, amount_cents, currency, provider, token, created_at, updated_at) VALUES ('o_paid', ?, 'a@x.com', 'paid', 5000, 'usd', 'stripe', 'tok_paid', ?, ?)", TENANT, t, t);
  run("INSERT INTO payments (id, tenant_id, provider, provider_id, amount_cents, currency, status, order_id, created_at) VALUES ('p_paid', ?, 'stripe', 'cs_1', 5000, 'usd', 'succeeded', 'o_paid', ?)", TENANT, t);

  // Partially refunded order: still `paid`, with refunded_cents recorded.
  run("INSERT INTO orders (id, tenant_id, email, status, amount_cents, refunded_cents, currency, provider, token, created_at, updated_at) VALUES ('o_partial', ?, 'b@x.com', 'paid', 4000, 1500, 'usd', 'stripe', 'tok_partial', ?, ?)", TENANT, t, t);
  run("INSERT INTO refunds (id, tenant_id, order_id, amount_cents, currency, provider, status, created_at, updated_at) VALUES ('r_partial', ?, 'o_partial', 1500, 'usd', 'stripe', 'succeeded', ?, ?)", TENANT, t, t);

  // Fully refunded order.
  run("INSERT INTO orders (id, tenant_id, email, status, amount_cents, refunded_cents, currency, provider, token, created_at, updated_at) VALUES ('o_refunded', ?, 'c@x.com', 'refunded', 2000, 2000, 'usd', 'stripe', 'tok_refunded', ?, ?)", TENANT, t, t);
  run("INSERT INTO refunds (id, tenant_id, order_id, amount_cents, currency, provider, status, created_at, updated_at) VALUES ('r_full', ?, 'o_refunded', 2000, 'usd', 'stripe', 'succeeded', ?, ?)", TENANT, t, t);

  // A standalone (non-order) charge, e.g. a future subscription invoice.
  run("INSERT INTO payments (id, tenant_id, provider, provider_id, amount_cents, currency, status, order_id, created_at) VALUES ('p_standalone', ?, 'stripe', 'in_1', 1000, 'usd', 'succeeded', '', ?)", TENANT, t);

  // Another tenant's money must never appear.
  run("INSERT INTO orders (id, tenant_id, email, status, amount_cents, currency, provider, token, created_at, updated_at) VALUES ('o_other', ?, 'z@x.com', 'paid', 9999, 'usd', 'stripe', 'tok_other', ?, ?)", OTHER, t, t);

  // MRR movement history.
  const events: Array<[string, string, string, string, string, string, string]> = [
    // from_plan, to_plan, from_status, to_status, currency, provider, subscription
    ["", "creator", "", "active", "usd", "dodo", "sub_new"],
    ["creator", "pro", "active", "active", "usd", "dodo", "sub_exp"],
    ["pro", "creator", "active", "active", "usd", "dodo", "sub_con"],
    ["creator", "", "active", "canceled", "usd", "dodo", "sub_churn"],
    ["starter", "starter", "active", "past_due", "usd", "dodo", "sub_grace"],
  ];
  events.forEach(([from, to, fs, ts, ccy, prov, sid], i) => {
    run(
      `INSERT INTO subscription_events
         (id, tenant_id, subscription_id, provider, from_plan, to_plan, from_status, to_status, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      `ev${i}`,
      TENANT,
      sid,
      prov,
      from,
      to,
      fs,
      ts,
      ccy,
      t
    );
  });
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("refund-aware revenue", () => {
  it("counts a store sale once, not once per table", () => {
    const snap = revenueSnapshot(TENANT, 30);
    // 5000 paid + (4000-1500) partial + 0 refunded + 1000 standalone
    expect(snap.net).toEqual([{ currency: "usd", cents: 8500 }]);
    expect(snap.period).toEqual(snap.net);
    // Everything collected before refunds: 5000 + 4000 + 2000 + 1000
    expect(snap.gross).toEqual([{ currency: "usd", cents: 12000 }]);
    // 1500 + 2000
    expect(snap.refunds).toEqual([{ currency: "usd", cents: 3500 }]);
  });

  it("keeps gross - refunds consistent with net", () => {
    const snap = revenueSnapshot(TENANT, 30);
    const byCurrency = (rows: { currency: string; cents: number }[], c: string) =>
      rows.find((r) => r.currency === c)?.cents ?? 0;
    expect(byCurrency(snap.gross, "usd") - byCurrency(snap.refunds, "usd")).toBe(byCurrency(snap.net, "usd"));
  });

  it("is not affected by another tenant's orders", () => {
    expect(revenueSnapshot(OTHER, 30).net).toEqual([{ currency: "usd", cents: 9999 }]);
  });

  it("shows refunds as a negative month in the series", () => {
    const series = revenueMonthlySeries(TENANT, 2);
    const last = series[series.length - 1];
    // gross 12000 - refunds 3500
    expect(last.byCurrency).toEqual([{ currency: "usd", cents: 8500 }]);
    expect(last.scale).toBe(8500);
  });

  it("never returns a negative bar scale", () => {
    // A month where refunds exceed sales must not produce a negative height.
    run("INSERT INTO refunds (id, tenant_id, order_id, amount_cents, currency, provider, status, created_at, updated_at) VALUES ('r_huge', ?, 'o_paid', 900000, 'usd', 'stripe', 'succeeded', ?, ?)", TENANT, nowIso(), nowIso());
    const series = revenueMonthlySeries(TENANT, 1);
    expect(series[series.length - 1].scale).toBe(0);
    expect(series[series.length - 1].byCurrency[0].cents).toBeLessThan(0);
  });
});

describe("MRR movement", () => {
  it("splits new, expansion, contraction and churn per plan price", () => {
    const m = mrrMovement({ tenantId: TENANT, days: 30 });
    expect(m.new).toEqual([{ currency: "usd", cents: 1900 }]); // creator $19
    expect(m.expansion).toEqual([{ currency: "usd", cents: 3000 }]); // creator -> pro
    expect(m.contraction).toEqual([{ currency: "usd", cents: 3000 }]); // pro -> creator
    expect(m.churned).toEqual([{ currency: "usd", cents: 1900 }]); // creator -> canceled
  });

  it("does not treat a past_due status ping as movement", () => {
    const m = mrrMovement({ tenantId: TENANT, days: 30 });
    const total = [...m.new, ...m.expansion, ...m.contraction, ...m.churned].reduce((s, a) => s + a.cents, 0);
    // 1900 + 3000 + 3000 + 1900 — the starter->starter past_due event adds nothing.
    expect(total).toBe(9800);
  });

  it("nets to zero when growth and loss cancel out", () => {
    const m = mrrMovement({ tenantId: TENANT, days: 30 });
    expect(m.net).toEqual([]);
  });

  it("excludes events outside the window", () => {
    run(
      `INSERT INTO subscription_events (id, tenant_id, subscription_id, provider, from_plan, to_plan, from_status, to_status, currency, created_at)
       VALUES ('ev_old', ?, 'sub_old', 'dodo', '', 'business', '', 'active', 'usd', ?)`,
      TENANT,
      new Date(Date.now() - 90 * 86400000).toISOString()
    );
    const m = mrrMovement({ tenantId: TENANT, days: 30 });
    expect(m.new).toEqual([{ currency: "usd", cents: 1900 }]);
  });
});
