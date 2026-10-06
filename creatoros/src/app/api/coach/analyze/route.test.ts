import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  session: null as { org: { id: string }; role: string } | null,
  complete: vi.fn(),
  aiConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/auth/get-session", () => ({ getSession: async () => mocks.session }));
vi.mock("@/lib/auth/rbac", () => ({ can: () => true }));
vi.mock("@/lib/ai/client", () => ({
  aiConfigured: () => mocks.aiConfigured(),
  complete: mocks.complete,
  extractJson: (t: string) => JSON.parse(t),
}));

vi.mock("@/lib/analytics/engine", () => ({
  summary: () => ({ views: 0, leads: 0 }),
  timeSeries: () => [],
  breakdownBy: () => [],
}));

vi.mock("@/lib/db/db", () => ({
  row: (sql: string) => (sql.includes("organizations") ? { plan: "free" } : null),
  all: () => [],
  run: () => {},
}));

const bumped: { metric: string }[] = [];
vi.mock("@/lib/usage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/usage")>("@/lib/usage");
  return {
    ...actual,
    getUsage: () => USAGE,
    bumpUsage: (_t: string, metric: string) => {
      bumped.push({ metric });
      USAGE += 1;
      return USAGE;
    },
  };
});

let USAGE = 0;

const VALID = { score: 80, summary: "s", wins: [], opportunities: [], quickWins: [], nextTarget: "t" };
const call = async () => {
  const { POST } = await import("@/app/api/coach/analyze/route");
  return POST(new NextRequest("http://localhost/api/coach/analyze?days=30", { method: "POST" }));
};

beforeEach(() => {
  USAGE = 0;
  bumped.length = 0;
  mocks.session = { org: { id: "org_coach" }, role: "owner" };
  mocks.aiConfigured.mockReturnValue(true);
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

describe("unconfigured provider", () => {
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
  });
});

describe("credit ordering (D-7)", () => {
  it("consumes a credit when it calls the provider", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    expect(bumped).toEqual([{ metric: "aiCredits" }]);
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
    expect(bumped).toHaveLength(0);
  });

  it("does not spend a credit when the provider fails", async () => {
    mocks.complete.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call();
    expect(res.status).toBe(502);
    // No usable answer, so no metered credit is consumed.
    expect(bumped).toHaveLength(0);
  });

  it("does not forward a provider error body to the client", async () => {
    mocks.complete.mockRejectedValue(new Error("provider said: sk-secret lead a@a.com"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call();
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/sk-secret|a@a\.com/);
  });

  it("reports remaining credits to the user", async () => {
    USAGE = 3;
    const res = await call();
    const body = await res.json();
    expect(body.data.creditsRemaining).toBe(6); // free plan = 10, 3 used, this call consumed the 4th
  });
});

describe("auth", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.session = null;
    const res = await call();
    expect(res.status).toBe(401);
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
