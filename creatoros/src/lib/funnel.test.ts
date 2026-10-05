import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, newId, nowIso } from "@/lib/db/db";
import { recordFunnelEvent, funnelSummary, isFirstFunnelEvent, FUNNEL_STEPS } from "./funnel";

/**
 * The funnel is the thing that tells us whether anyone is converting. Its two
 * hard requirements are that it never breaks what it measures (a signup must not
 * 500 because a reporting row failed) and that it cannot be inflated by repeat
 * events (re-saving a page must not make activation look better than it is).
 */

let dir: string;
const A = "org_funnel_a";
const B = "org_funnel_b";

function seedOrg(id: string) {
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)",
    id,
    id,
    `${id}-slug`,
    nowIso(),
    nowIso()
  );
}

function countOf(step: string): number {
  return Number(row<{ c: number }>("SELECT COUNT(DISTINCT tenant_id) AS c FROM funnel_events WHERE step = ?", step)?.c ?? 0);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-funnel-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  seedOrg(A);
  seedOrg(B);
});

beforeEach(() => {
  run("DELETE FROM funnel_events");
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("funnel recording", () => {
  it("records a step with its plan, currency and amount", () => {
    recordFunnelEvent({
      step: "checkout_started",
      tenantId: A,
      userId: "usr_1",
      plan: "creator",
      currency: "inr",
      amountCents: 159900,
      source: "cashfree",
    });

    const r = row<{ step: string; plan: string; currency: string; amount_cents: number; source: string }>(
      "SELECT step, plan, currency, amount_cents, source FROM funnel_events WHERE tenant_id = ?",
      A
    );
    expect(r?.step).toBe("checkout_started");
    expect(r?.plan).toBe("creator");
    expect(r?.currency).toBe("inr");
    expect(r?.amount_cents).toBe(159900);
    expect(r?.source).toBe("cashfree");
  });

  it("counts distinct tenants, not raw events, so repeats cannot inflate a step", () => {
    // The same account saves its page three times.
    for (let i = 0; i < 3; i++) recordFunnelEvent({ step: "activation_reached", tenantId: A });
    recordFunnelEvent({ step: "activation_reached", tenantId: B });

    const raw = Number(row<{ c: number }>("SELECT COUNT(*) AS c FROM funnel_events WHERE step = ?", "activation_reached")?.c ?? 0);
    expect(raw).toBe(4);
    expect(countOf("activation_reached")).toBe(2);
  });

  it("reports first-time only through isFirstFunnelEvent", () => {
    expect(isFirstFunnelEvent(A, "activation_reached")).toBe(true);
    recordFunnelEvent({ step: "activation_reached", tenantId: A });
    expect(isFirstFunnelEvent(A, "activation_reached")).toBe(false);
    // A different step for the same tenant is still unclaimed.
    expect(isFirstFunnelEvent(A, "purchase_completed")).toBe(true);
  });

  it("never throws when the write fails", () => {
    // A constraint violation is the cheapest way to force a genuine DB error.
    const bad = row("SELECT sql FROM sqlite_master WHERE name = 'funnel_events'") as { sql: string } | undefined;
    expect(bad?.sql).toBeTruthy();
    run("DROP TABLE funnel_events");

    // Must not throw: a signup must never 500 because reporting failed.
    expect(() => recordFunnelEvent({ step: "signup_completed", tenantId: A })).not.toThrow();

    // Put it back so the rest of the file still runs.
    run(`CREATE TABLE funnel_events (
      id TEXT PRIMARY KEY, step TEXT NOT NULL, tenant_id TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '', plan TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT '',
      meta TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
    )`);
  });
});

describe("funnel summary", () => {
  it("counts every step in the window", () => {
    recordFunnelEvent({ step: "signup_completed", tenantId: A });
    recordFunnelEvent({ step: "activation_reached", tenantId: A });
    recordFunnelEvent({ step: "purchase_completed", tenantId: A });

    const s = funnelSummary(30);
    expect(s.steps.map((x) => x.step)).toEqual([...FUNNEL_STEPS]);
    expect(s.steps.find((x) => x.step === "signup_completed")?.count).toBe(1);
    expect(s.steps.find((x) => x.step === "checkout_started")?.count).toBe(0);
    expect(s.steps.find((x) => x.step === "subscription_canceled")?.count).toBe(0);
  });

  it("computes step-to-step conversion and marks a null rate rather than dividing by zero", () => {
    // No signups at all: rates must be null, never NaN or 0%.
    const empty = funnelSummary(30);
    expect(empty.conversion.every((c) => c.rate === null)).toBe(true);

    recordFunnelEvent({ step: "signup_completed", tenantId: A });
    recordFunnelEvent({ step: "signup_completed", tenantId: B });
    recordFunnelEvent({ step: "activation_reached", tenantId: A });
    recordFunnelEvent({ step: "purchase_completed", tenantId: A });

    const s = funnelSummary(30);
    const signupToActivation = s.conversion.find((c) => c.from === "signup_completed" && c.to === "activation_reached");
    expect(signupToActivation?.rate).toBe(50);

    const activationToCheckout = s.conversion.find((c) => c.from === "activation_reached" && c.to === "checkout_started");
    expect(activationToCheckout?.rate).toBe(0);

    const signupToPaid = s.conversion.find((c) => c.from === "signup_completed" && c.to === "purchase_completed");
    expect(signupToPaid?.rate).toBe(50);
  });

  it("ignores events older than the window", () => {
    recordFunnelEvent({ step: "signup_completed", tenantId: A });
    // Age this one out of a 7-day window, but keep it inside a 365-day one.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    run("UPDATE funnel_events SET created_at = ? WHERE tenant_id = ?", thirtyDaysAgo, A);

    const s = funnelSummary(7);
    expect(s.steps.find((x) => x.step === "signup_completed")?.count).toBe(0);

    const wide = funnelSummary(365);
    expect(wide.steps.find((x) => x.step === "signup_completed")?.count).toBe(1);
  });

  it("joins activation and paid status onto the recent signup list", () => {
    recordFunnelEvent({ step: "signup_completed", tenantId: A, source: "twitter" });
    recordFunnelEvent({ step: "activation_reached", tenantId: A });
    recordFunnelEvent({ step: "purchase_completed", tenantId: A, plan: "creator" });
    recordFunnelEvent({ step: "signup_completed", tenantId: B, source: "direct" });

    const s = funnelSummary(30);
    const a = s.recentSignups.find((x) => x.tenant_id === A);
    const b = s.recentSignups.find((x) => x.tenant_id === B);

    expect(a?.activated).toBe(true);
    expect(a?.paid).toBe(true);
    expect(a?.source).toBe("twitter");
    expect(b?.activated).toBe(false);
    expect(b?.paid).toBe(false);
    expect(b?.source).toBe("direct");
  });

  it("does not list a tenant that never signed up as having paid", () => {
    recordFunnelEvent({ step: "purchase_completed", tenantId: A });
    const s = funnelSummary(30);
    // Nothing in recentSignups, because recentSignups is driven by signups.
    expect(s.recentSignups).toHaveLength(0);
    // ...but the step is still counted, so the number cannot hide.
    expect(s.steps.find((x) => x.step === "purchase_completed")?.count).toBe(1);
  });
});

describe("funnel survives org deletion", () => {
  it("keeps history when the workspace is deleted", async () => {
    // Deliberate: tenant_id has no foreign key, because the org disappearing is
    // itself a churn signal and must not erase the record of it.
    const id = newId("org");
    seedOrg(id);
    recordFunnelEvent({ step: "signup_completed", tenantId: id });
    recordFunnelEvent({ step: "purchase_completed", tenantId: id, plan: "creator" });

    run("DELETE FROM organizations WHERE id = ?", id);

    const s = funnelSummary(30);
    const signups = s.steps.find((x) => x.step === "signup_completed")?.count ?? 0;
    expect(signups).toBeGreaterThanOrEqual(1);
    const orphan = row("SELECT tenant_id FROM funnel_events WHERE tenant_id = ?", id);
    expect(orphan).toBeTruthy();
  });
});