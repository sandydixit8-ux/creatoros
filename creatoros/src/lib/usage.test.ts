import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb, nowIso, run } from "@/lib/db/db";
import { allUsage, getUsage, refundUsage, reserveUsage } from "./usage";

const TENANT = "org_usage_test";
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-usage-"));
  process.env.CREATOROS_DB_PATH = join(dir, "t.db");
  getDb();
  const now = nowIso();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'U', 'u-org', 'free', ?, ?)",
    TENANT,
    now,
    now
  );
});

afterAll(() => {
  closeDb();
  delete process.env.CREATOROS_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

const clear = () => run("DELETE FROM plans_usage WHERE tenant_id = ?", TENANT);

describe("reserveUsage", () => {
  it("takes the credit and returns the new total", () => {
    clear();
    expect(reserveUsage(TENANT, "aiCredits", 10)).toBe(1);
    expect(reserveUsage(TENANT, "aiCredits", 10)).toBe(2);
    expect(getUsage(TENANT, "aiCredits")).toBe(2);
  });

  it("allows the final credit at exactly the limit", () => {
    clear();
    run(
      "INSERT INTO plans_usage (id, tenant_id, metric, period, used) VALUES ('pu_x', ?, 'aiCredits', ?, 9)",
      TENANT,
      new Date().toISOString().slice(0, 7)
    );
    expect(reserveUsage(TENANT, "aiCredits", 10)).toBe(10);
    // Now at the limit: the next one is refused.
    expect(reserveUsage(TENANT, "aiCredits", 10)).toBeNull();
  });

  it("refuses without taking a credit", () => {
    clear();
    const period = new Date().toISOString().slice(0, 7);
    run(
      "INSERT INTO plans_usage (id, tenant_id, metric, period, used) VALUES ('pu_y', ?, 'aiCredits', ?, 10)",
      TENANT,
      period
    );
    expect(reserveUsage(TENANT, "aiCredits", 10)).toBeNull();
    expect(getUsage(TENANT, "aiCredits")).toBe(10);
  });

  it("treats limit -1 as unlimited", () => {
    clear();
    for (let i = 0; i < 50; i++) expect(reserveUsage(TENANT, "aiCredits", -1)).not.toBeNull();
    expect(getUsage(TENANT, "aiCredits")).toBe(50);
  });

  it("does not overshoot when reserving more than one unit at the boundary", () => {
    clear();
    run(
      "INSERT INTO plans_usage (id, tenant_id, metric, period, used) VALUES ('pu_z', ?, 'aiCredits', ?, 9)",
      TENANT,
      new Date().toISOString().slice(0, 7)
    );
    // 9 + 2 > 10, so a 2-unit reservation must fail outright rather than land
    // at 11 and leave the counter over the limit.
    expect(reserveUsage(TENANT, "aiCredits", 10, 2)).toBeNull();
    expect(getUsage(TENANT, "aiCredits")).toBe(9);
  });

  it("records the credit before the work it pays for", () => {
    // The reservation is what makes the route's ordering safe: the meter is
    // already incremented when the provider is called, so a crash mid-call
    // cannot produce a free analysis.
    clear();
    reserveUsage(TENANT, "aiCredits", 10);
    expect(allUsage(TENANT).aiCredits).toBe(1);
  });
});

describe("refundUsage", () => {
  it("gives back a reservation whose work failed", () => {
    clear();
    reserveUsage(TENANT, "aiCredits", 10);
    reserveUsage(TENANT, "aiCredits", 10);
    expect(refundUsage(TENANT, "aiCredits")).toBe(1);
    expect(getUsage(TENANT, "aiCredits")).toBe(1);
  });

  it("never goes below zero", () => {
    clear();
    reserveUsage(TENANT, "aiCredits", 10);
    expect(refundUsage(TENANT, "aiCredits", 5)).toBe(0);
    expect(getUsage(TENANT, "aiCredits")).toBe(0);
  });

  it("is a no-op when there is nothing recorded", () => {
    clear();
    expect(refundUsage(TENANT, "emailsPerMonth")).toBe(0);
    expect(allUsage(TENANT).emailsPerMonth).toBeUndefined();
  });

  it("does not disturb other metrics", () => {
    clear();
    reserveUsage(TENANT, "aiCredits", 10);
    reserveUsage(TENANT, "viewsPerMonth", -1);
    refundUsage(TENANT, "aiCredits");
    expect(getUsage(TENANT, "viewsPerMonth")).toBe(1);
  });
});
