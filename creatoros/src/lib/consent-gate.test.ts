import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { getDb, closeDb, run, all, nowIso } from "@/lib/db/db";
import { POST } from "@/app/api/track/route";

/**
 * D-5: the consent gate must hold on the server.
 *
 * Hiding the tracking call in the browser is not a control - /api/track is a
 * public endpoint anyone can call directly. These tests call the route the same
 * way an attacker or a curl command would, and assert that nothing is written
 * to storage without consent.
 */

let dir: string;
const TENANT = "org_consent_gate";
const USER = "usr_consent_gate";
const USERNAME = "consentgate";

function request(body: unknown, ip = "203.0.113.9"): NextRequest {
  return new NextRequest("https://usecreatoros.co/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function eventCount(): number {
  return all("SELECT id FROM analytics_events WHERE tenant_id = ?", TENANT).length;
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

describe("D-5: /api/track refuses to record without consent", () => {
  it("records nothing when the consent field is absent entirely", async () => {
    const res = await POST(request({ username: USERNAME, eventType: "page_view" }));
    const json = (await res.json()) as { ok: boolean; data: { tracked: boolean; consent: boolean } };

    expect(json.ok).toBe(true);
    expect(json.data.tracked).toBe(false);
    expect(json.data.consent).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("records nothing when consent is explicitly refused", async () => {
    const res = await POST(
      request({ username: USERNAME, eventType: "page_view", consent: { analytics: false } })
    );
    const json = (await res.json()) as { data: { tracked: boolean } };

    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("records nothing for a link click without consent either", async () => {
    const res = await POST(
      request({ username: USERNAME, eventType: "link_click", ref: "https://example.com" })
    );
    const json = (await res.json()) as { data: { tracked: boolean } };

    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("still rejects a malformed payload rather than defaulting to consent", async () => {
    const res = await POST(request({ username: USERNAME, consent: { analytics: "yes" } }));
    expect(res.status).toBe(400);
    expect(eventCount()).toBe(0);
  });
});

describe("D-5: /api/track records once consent is given", () => {
  it("stores the event when analytics consent is present", async () => {
    const res = await POST(
      request({
        username: USERNAME,
        eventType: "page_view",
        visitorId: "visitor-abc",
        consent: { analytics: true },
      })
    );
    const json = (await res.json()) as { data: { tracked: boolean } };

    expect(json.data.tracked).toBe(true);
    expect(eventCount()).toBe(1);
  });

  it("captures the visitor fields only after consent", async () => {
    await POST(
      request({
        username: USERNAME,
        eventType: "link_click",
        ref: "https://example.com",
        utm_source: "newsletter",
        visitorId: "visitor-xyz",
        consent: { analytics: true },
      })
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
    await POST(request({ username: USERNAME, eventType: "page_view" }));
    const after = all("SELECT * FROM plans_usage WHERE tenant_id = ?", TENANT).length;
    expect(after).toBe(before);
  });

  it("still validates the bio page exists for a consenting request", async () => {
    const res = await POST(
      request({ username: "does-not-exist", consent: { analytics: true } })
    );
    expect(res.status).toBe(404);
    expect(eventCount()).toBe(0);
  });
});

describe("D-5: consent cannot be smuggled through extra fields", () => {
  it("ignores an unknown top-level consent flag", async () => {
    const res = await POST(
      request({ username: USERNAME, eventType: "page_view", consentGranted: true })
    );
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("rejects a null consent object rather than coercing it", async () => {
    // `.default()` only fills in `undefined`. An explicit null is a malformed
    // payload and must be refused, not quietly treated as a decision.
    const res = await POST(request({ username: USERNAME, consent: null }));
    expect(res.status).toBe(400);
    expect(eventCount()).toBe(0);
  });

  it("does not accept an unknown id field as a substitute for consent", async () => {
    const res = await POST(
      request({ username: USERNAME, eventType: "page_view", consentId: "abc", jti: "x" })
    );
    const json = (await res.json()) as { data: { tracked: boolean } };
    expect(json.data.tracked).toBe(false);
    expect(eventCount()).toBe(0);
  });
});