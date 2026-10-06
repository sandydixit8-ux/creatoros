import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: null as { org: { id: string }; role: string } | null,
  complete: vi.fn(),
  aiConfigured: vi.fn(() => true),
  checkFlag: vi.fn((_flag: string) => true),
  revenue: [] as { currency: string; cents: number }[],
  reserved: [] as number[],
  refunded: [] as number[],
  sqlCalls: [] as string[],
}));

vi.mock("@/lib/auth/get-session", () => ({ getSession: async () => mocks.session }));
vi.mock("@/lib/auth/rbac", () => ({ can: () => true }));
vi.mock("@/lib/ai/client", () => ({
  aiConfigured: () => mocks.aiConfigured(),
  complete: mocks.complete,
  extractJson: (t: string) => JSON.parse(t),
}));
vi.mock("@/lib/admin/engine", () => ({ checkFlag: (f: string) => mocks.checkFlag(f) }));
vi.mock("@/lib/analytics/money", () => ({ revenueSnapshot: () => ({ period: mocks.revenue }) }));

vi.mock("@/lib/analytics/engine", () => ({
  summary: () => ({ visitors: 10, pageViews: 20, leads: 3 }),
  timeSeries: () => [],
  breakdownBy: () => [],
}));

vi.mock("@/lib/db/db", () => ({
  row: (sql: string) => (sql.includes("organizations") ? { plan: "free" } : undefined),
  // The contacts table really does hold email addresses.
  //
  // The mock projects only the columns the query asked for, the way SQLite does.
  // An earlier version returned the whole row regardless, which let an
  // `email` appear in the provider prompt no matter what the route selected -
  // a lying mock that would have hidden exactly the bug this file guards.
  all: (sql: string) => {
    mocks.sqlCalls.push(sql);
    if (!sql.includes("FROM contacts")) return [];
    return [project(sql, { captured_at: "2026-10-05T10:00:00.000Z", email: "lead@example.com", name: "Lead" })];
  },
  run: () => ({ changes: 0, lastInsertRowid: 0 }),
}));

/** Return only the selected columns of `source`, honouring `col AS alias`. */
function project(sql: string, source: Record<string, unknown>): Record<string, unknown> {
  const list = sql.slice(sql.indexOf("SELECT") + "SELECT".length, sql.indexOf("FROM"));
  const out: Record<string, unknown> = {};
  for (const part of list.split(",")) {
    const [col, alias] = part.trim().split(/\s+AS\s+/i);
    const key = (alias ?? col).trim();
    if (key in source) out[key] = source[key];
  }
  return out;
}

let USAGE = 0;
vi.mock("@/lib/usage", () => ({
  // Mirrors the real contract: reserve succeeds only while under the limit and
  // returns the new total; the real implementation's atomicity is tested
  // directly in src/lib/usage.test.ts.
  reserveUsage: (_t: string, metric: string, limit: number, amount = 1) => {
    if (metric !== "aiCredits") return USAGE;
    if (limit !== -1 && USAGE + amount > limit) return null;
    USAGE += amount;
    mocks.reserved.push(USAGE);
    return USAGE;
  },
  refundUsage: (_t: string, metric: string, amount = 1) => {
    if (metric !== "aiCredits") return USAGE;
    USAGE = Math.max(0, USAGE - amount);
    mocks.refunded.push(USAGE);
    return USAGE;
  },
}));

const VALID = { score: 80, summary: "s", wins: [], opportunities: [], quickWins: [], nextTarget: "t" };

/** The user-data payload handed to the provider: messages[1]. */
const promptOf = (): string => {
  const [messages] = mocks.complete.mock.calls[0] as unknown as [{ content: string }[], unknown];
  return messages[1].content;
};

const call = async () => {
  const { POST } = await import("@/app/api/coach/analyze/route");
  return POST(new NextRequest("http://localhost/api/coach/analyze?days=30", { method: "POST" }));
};

beforeEach(() => {
  USAGE = 0;
  mocks.reserved.length = 0;
  mocks.refunded.length = 0;
  mocks.revenue = [];
  mocks.sqlCalls.length = 0;
  mocks.session = { org: { id: "org_coach" }, role: "owner" };
  mocks.aiConfigured.mockReset();
  mocks.aiConfigured.mockReturnValue(true);
  mocks.checkFlag.mockReset();
  mocks.checkFlag.mockReturnValue(true);
  mocks.complete.mockReset();
  mocks.complete.mockResolvedValue({ text: JSON.stringify(VALID) });
});

describe("GET /api/coach/analyze is no longer exported", () => {
  // The route spends a metered credit and a paid provider call, so it must not
  // be reachable by a prefetcher, crawler or reload.
  it("does not expose a GET handler", async () => {
    const mod = await import("@/app/api/coach/analyze/route");
    expect((mod as Record<string, unknown>).GET).toBeUndefined();
    expect(typeof mod.POST).toBe("function");
  });
});

describe("unavailable states", () => {
  it("returns 503 with a user-safe message and never calls the provider", async () => {
    mocks.aiConfigured.mockReturnValue(false);
    const res = await call();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.ok).toBe(false);
    // An operator runbook must not reach the customer dashboard.
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/AI_API_KEY|OPENAI_API_KEY|\.env/i);

    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.reserved).toHaveLength(0);
  });

  it("honours the ai_coach kill switch even when a key is configured", async () => {
    mocks.checkFlag.mockReturnValue(false);

    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ai_disabled");

    // The point of the switch: no provider spend and no metered credit burned
    // when an admin turns this off.
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.reserved).toHaveLength(0);
  });

  it("checks the kill switch before the key, so disabling works with a key present", async () => {
    mocks.checkFlag.mockReturnValue(false);
    mocks.aiConfigured.mockReturnValue(true);
    const res = await call();
    expect((await res.json()).error.code).toBe("ai_disabled");
  });
});

describe("credit ordering (D-7)", () => {
  it("reserves a credit before calling the provider", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    expect(mocks.reserved).toEqual([1]);
  });

  it("allows the final credit at exactly the limit", async () => {
    // hasQuota is `used < limit`, so the 10th call against a free plan's limit
    // of 10 is permitted. Off-by-one guard against "fixing" this into a
    // premature lockout.
    USAGE = 9;
    const res = await call();
    expect(res.status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledTimes(1);
  });

  it("refuses over-quota tenants BEFORE any provider call", async () => {
    USAGE = 10; // free plan limit is 10; the 11th request is over quota
    const res = await call();
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.error.code).toBe("ai_quota_exhausted");

    // The regression that matters: the old order called the paid provider
    // first, so an over-quota tenant got a full answer for free.
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.reserved).toHaveLength(0);
  });

  it("refunds the reserved credit when the provider fails", async () => {
    mocks.complete.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call();
    expect(res.status).toBe(502);

    // Taken up front, handed back on failure: an outage must not spend a
    // metered unit the tenant never received value for.
    expect(mocks.reserved).toEqual([1]);
    expect(mocks.refunded).toEqual([0]);
    expect(USAGE).toBe(0);
  });

  it("does not forward a provider error body to the client", async () => {
    mocks.complete.mockRejectedValue(new Error("provider said: sk-secret lead@example.com"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call();
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/sk-secret|lead@example\.com/);
  });

  it("reports remaining credits from the reservation, not a stale pre-call read", async () => {
    USAGE = 3;
    const res = await call();
    const body = await res.json();
    expect(body.data.creditsRemaining).toBe(6); // free plan = 10, 3 used, this call consumed the 4th
  });
});

describe("what crosses the provider boundary", () => {
  it("never sends lead email addresses to the provider", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledTimes(1);

    // First, the query itself must not read the column. The mock projects only
    // what is selected, so if `email` is ever added back to the SELECT this
    // assertion fails instead of quietly passing on a full-row mock.
    const contactsQuery = mocks.sqlCalls.find((s) => s.includes("FROM contacts")) ?? "";
    expect(contactsQuery).toMatch(/SELECT created_at AS captured_at FROM contacts/);
    expect(contactsQuery).not.toMatch(/\bemail\b/i);

    // Then, the payload itself.
    const prompt = promptOf();
    expect(prompt).not.toMatch(/lead@example\.com/);
    expect(prompt).not.toMatch(/email/i);

    // Lead timing still reaches the model, which is what it actually reasons about.
    expect(prompt).toContain("leadRecency");
    expect(prompt).toContain("2026-10-05T10:00:00.000Z");
  });

  it("sends revenue split by currency and never a blended total", async () => {
    mocks.revenue = [
      { currency: "usd", cents: 12500 },
      { currency: "inr", cents: 74900 },
    ];

    const res = await call();
    expect(res.status).toBe(200);

    const prompt = promptOf();
    expect(prompt).toContain('"currency":"usd"');
    expect(prompt).toContain('"currency":"inr"');
    // The old context passed summary().revenueCents, which added INR to USD and
    // had the coach call the result dollars.
    expect(prompt).not.toMatch(/revenueCents/);
  });

  it("tells the model never to convert or combine currencies", async () => {
    await call();
    const [messages] = mocks.complete.mock.calls[0] as unknown as [{ content: string }[], unknown];
    const system = messages[0].content;
    expect(system).toMatch(/NEVER add, convert or compare amounts in different currencies/i);
    expect(system).toMatch(/do not invent an exchange rate/i);
  });
});

describe("auth", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.session = null;
    const res = await call();
    expect(res.status).toBe(401);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.reserved).toHaveLength(0);
  });
});
