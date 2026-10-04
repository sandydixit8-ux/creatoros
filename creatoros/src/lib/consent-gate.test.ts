import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { getDb, closeDb, run, all, nowIso } from "@/lib/db/db";
import { POST as track } from "@/app/api/track/route";
import { POST as recordConsent } from "@/app/api/consent/route";
import { CONSENT_COOKIE_NAME } from "@/lib/consent-receipt";

/**
 * D-5: the consent gate must hold on the server.
 *
 * Hiding the tracking call in the browser is not a control - /api/track is a
 * public endpoint anyone can call directly. These tests call the routes the way
 * an attacker or a curl command would, and assert that nothing reaches storage
 * without a consent receipt the server itself minted.
 */

let dir: string;
const TENANT = "org_consent_gate";
const USER = "usr_consent_gate";
const USERNAME = "consentgate";

function trackRequest(body: unknown, cookie?: string, ip = "203.0.113.9"): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-forwarded-for": ip,
  };
  if (cookie) headers.Cookie = cookie;
  return new NextRequest("https://usecreatoros.co/api/track", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function eventCount(): number {
  return all("SELECT id FROM analytics_events WHERE tenant_id = ?", TENANT).length;
}

/** Pull the Set-Cookie value the consent endpoint issued. */
async function grantViaApi(
  analytics: boolean,
  source: "banner" | "preferences" | "withdrawn" = "banner"
): Promise<string> {
  const res = await recordConsent(
    new NextRequest("https://usecreatoros.co/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ analytics, source }),
    })
  );
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  return `${CONSENT_COOKIE_NAME}=${(setCookie as string).split(`${CONSENT_COOKIE_NAME}=`)[1].split(";")[0]}`;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-consent-gate-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();

  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Consent Gate', 'consent-gate', 'creator', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, 'gate@example.com', 'hash', 'Gate', 'user', ?, ?)",
    USER,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
    "mem_gate",
    TENANT,
    USER,
    nowIso()
  );
  run(
    "INSERT INTO profiles (id, tenant_id, user_id, username, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, 'Gate', ?, ?)",
    "prf_gate",
    TENANT,
    USER,
    USERNAME,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO bio_pages (id, tenant_id, profile_id, slug, title, published, theme, created_at, updated_at) VALUES (?, ?, ?, '', 'Home', 1, '{}', ?, ?)",
    "bp_gate",
    TENANT,
    "prf_gate",
    nowIso(),
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM analytics_events WHERE tenant_id = ?", TENANT);
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("D-5: /api/track refuses to record without a consent receipt", () => {
  it("records nothing when no cookie is sent at all", async () => {
    const res = await track(trackRequest({ username: USERNAME, eventType: "page_view" }));
    const json = (await res.json()) as { ok: boolean; data: { tracked: boolean; consent: boolean } };

    expect(json.ok).toBe(true);
    expect(json.data.tracked).toBe(false);
    expect(json.data.consent).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("records nothing for an unrelated cookie", async () => {
    const res = await track(
      trackRequest({ username: USERNAME, eventType: "page_view" }, "creatoros_session=abc")
    );
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("records nothing for a link click without a receipt either", async () => {
    const res = await track(
      trackRequest({ username: USERNAME, eventType: "link_click", ref: "https://example.com" })
    );
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("records nothing when the visitor refused consent", async () => {
    const cookie = await grantViaApi(false, "banner");
    const res = await track(trackRequest({ username: USERNAME, eventType: "page_view" }, cookie));
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("records nothing after consent is withdrawn", async () => {
    const cookie = await grantViaApi(false, "withdrawn");
    const res = await track(trackRequest({ username: USERNAME, eventType: "page_view" }, cookie));
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("ignores a body flag claiming consent when no receipt was ever issued", async () => {
    const res = await track(
      trackRequest({
        username: USERNAME,
        eventType: "page_view",
        consent: { analytics: true },
        consentGranted: true,
      })
    );
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("ignores a body flag claiming consent after a refusal", async () => {
    const cookie = await grantViaApi(false, "banner");
    const res = await track(
      trackRequest({ username: USERNAME, eventType: "page_view", consent: { analytics: true } }, cookie)
    );
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });
});

describe("D-5: a forged cookie cannot unlock tracking", () => {
  it("refuses an unsigned hand-rolled consent payload", async () => {
    const forged = Buffer.from(
      JSON.stringify({ a: "1", d: new Date().toISOString(), s: "banner", v: "1" })
    ).toString("base64url");

    const res = await track(
      trackRequest({ username: USERNAME, eventType: "page_view" }, `${CONSENT_COOKIE_NAME}=${forged}`)
    );
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("refuses a valid payload with a tampered signature", async () => {
    const cookie = await grantViaApi(true, "banner");
    const tampered = cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A");

    const res = await track(
      trackRequest({ username: USERNAME, eventType: "page_view" }, tampered)
    );
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("refuses a refusal receipt edited into a grant", async () => {
    // Take the real receipt for a refusal and flip the flag without re-signing.
    const cookie = await grantViaApi(false, "banner");
    const token = cookie.slice(`${CONSENT_COOKIE_NAME}=`.length);
    const [body, sig] = token.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    payload.a = "1";
    const edited = `${CONSENT_COOKIE_NAME}=${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;

    const res = await track(trackRequest({ username: USERNAME, eventType: "page_view" }, edited));
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });
});

describe("D-5: /api/track records once a receipt authorises it", () => {
  it("stores the event when the receipt grants analytics", async () => {
    const cookie = await grantViaApi(true, "banner");
    const res = await track(
      trackRequest({ username: USERNAME, eventType: "page_view", visitorId: "visitor-abc" }, cookie)
    );
    const json = (await res.json()) as { data: { tracked: boolean } };

    expect(json.data.tracked).toBe(true);
    expect(eventCount()).toBe(1);
  });

  it("captures the visitor fields only after consent", async () => {
    const cookie = await grantViaApi(true, "banner");
    await track(
      trackRequest(
        {
          username: USERNAME,
          eventType: "link_click",
          ref: "https://example.com",
          utm_source: "newsletter",
          visitorId: "visitor-xyz",
        },
        cookie
      )
    );

    const ev = all<{ event_type: string; ref: string; utm_source: string; visitor_id: string }>(
      "SELECT event_type, ref, utm_source, visitor_id FROM analytics_events WHERE tenant_id = ?",
      TENANT
    );
    expect(ev).toHaveLength(1);
    expect(ev[0].event_type).toBe("link_click");
    expect(ev[0].ref).toBe("https://example.com");
    expect(ev[0].utm_source).toBe("newsletter");
    // Stored as a salted hash, never the raw client id.
    expect(ev[0].visitor_id).not.toBe("visitor-xyz");
    expect(ev[0].visitor_id.length).toBeGreaterThan(0);
  });

  it("does not consume the views quota for an unconsented request", async () => {
    const before = all("SELECT * FROM plans_usage WHERE tenant_id = ?", TENANT).length;
    await track(trackRequest({ username: USERNAME, eventType: "page_view" }));
    const after = all("SELECT * FROM plans_usage WHERE tenant_id = ?", TENANT).length;
    expect(after).toBe(before);
  });

  it("still validates the bio page exists for a consenting request", async () => {
    const cookie = await grantViaApi(true, "banner");
    const res = await track(
      trackRequest({ username: "does-not-exist" }, cookie)
    );
    expect(res.status).toBe(404);
    expect(eventCount()).toBe(0);
  });

  it("rejects a malformed payload rather than defaulting it into a tracked event", async () => {
    const cookie = await grantViaApi(true, "banner");
    const res = await track(
      trackRequest({ username: USERNAME, eventType: "not_a_real_event" }, cookie)
    );
    expect(res.status).toBe(400);
    expect(eventCount()).toBe(0);
  });

  it("stops recording immediately once the receipt is replaced by a withdrawal", async () => {
    const granted = await grantViaApi(true, "banner");
    await track(trackRequest({ username: USERNAME, eventType: "page_view" }, granted));
    expect(eventCount()).toBe(1);

    const withdrawn = await grantViaApi(false, "withdrawn");
    await track(trackRequest({ username: USERNAME, eventType: "page_view" }, withdrawn));
    expect(eventCount()).toBe(1);
  });
});

describe("D-5: /api/consent mints receipts", () => {
  it("issues an HttpOnly cookie and confirms the decision", async () => {
    const res = await recordConsent(
      new NextRequest("https://usecreatoros.co/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.11" },
        body: JSON.stringify({ analytics: true, source: "preferences" }),
      })
    );
    const json = (await res.json()) as { data: { saved: boolean; analytics: boolean } };

    expect(json.data).toEqual({ saved: true, analytics: true });
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("refuses a decision that is not a boolean", async () => {
    const res = await recordConsent(
      new NextRequest("https://usecreatoros.co/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics: "yes" }),
      })
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("refuses an unrecognised source", async () => {
    const res = await recordConsent(
      new NextRequest("https://usecreatoros.co/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics: true, source: "curl" }),
      })
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});