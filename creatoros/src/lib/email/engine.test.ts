import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, newId, nowIso } from "@/lib/db/db";
import { recipientsFor, sendCampaign } from "./engine";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-email-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Test', 'test-email-org', 'creator', ?, ?)", TENANT, nowIso(), nowIso());
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const TENANT = "org_email_test";

function seedContact(email: string, consent: number): string {
  const id = newId("con");
  run("INSERT INTO contacts (id, tenant_id, email, name, consent, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '[]', ?, ?)", id, TENANT, email, `Name of ${email}`, consent, nowIso(), nowIso());
  return id;
}

describe("email engine recipient selection", () => {
  it("returns only consented contacts", () => {
    const ok = seedContact("a@example.com", 1);
    seedContact("b@example.com", 0);
    const recips = recipientsFor(TENANT);
    expect(recips.map((r) => r.id)).toContain(ok);
    expect(recips.every((r) => r.email !== "b@example.com")).toBe(true);
  });

  it("excludes unsubscribed emails", () => {
    seedContact("c@example.com", 1);
    run("INSERT INTO unsubscribes (id, tenant_id, email, created_at) VALUES (?, ?, ?, ?)", newId("uns"), TENANT, "c@example.com", nowIso());
    const recips = recipientsFor(TENANT);
    expect(recips.some((r) => r.email === "c@example.com")).toBe(false);
  });

  it("filters by list membership when a list is given", () => {
    const member = seedContact("member@example.com", 1);
    seedContact("outside@example.com", 1);
    const listId = newId("eml");
    run("INSERT INTO email_lists (id, tenant_id, name, created_at) VALUES (?, ?, 'seg', ?)", listId, TENANT, nowIso());
    run("INSERT INTO email_list_members (id, tenant_id, list_id, contact_id, created_at) VALUES (?, ?, ?, ?, ?)", newId("emmb"), TENANT, listId, member, nowIso());
    const recips = recipientsFor(TENANT, listId);
    expect(recips.map((r) => r.id)).toEqual([member]);
  });
});

const EMAIL_ENV_KEYS = [
  "NODE_ENV",
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "ALLOW_EMAIL_FILE_FALLBACK",
  "AUTH_SECRET",
] as const;

function seedCampaign(subject: string): string {
  const id = newId("emc");
  run(
    "INSERT INTO email_campaigns (id, tenant_id, subject, body, status, stats, created_at, updated_at) VALUES (?, ?, ?, '<p>hi</p>', 'draft', '{}', ?, ?)",
    id,
    TENANT,
    subject,
    nowIso(),
    nowIso()
  );
  return id;
}

describe("D-3: campaign delivery accounting", () => {
  beforeEach(() => {
    run("DELETE FROM email_campaigns WHERE tenant_id = ?", TENANT);
    run("DELETE FROM email_sends WHERE tenant_id = ?", TENANT);
    // sendCampaign targets every consented contact in the tenant, so clear the
    // list seeded by the selection tests to keep recipient counts exact.
    run("DELETE FROM contacts WHERE tenant_id = ?", TENANT);
    for (const k of EMAIL_ENV_KEYS) delete process.env[k];
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "test-secret-with-enough-entropy-1234");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("marks the campaign partial when the provider fails for only some recipients", async () => {
    seedContact("p1@example.com", 1);
    seedContact("p2@example.com", 1);
    const campaignId = seedCampaign("Partial");

    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        return call === 1
          ? Response.json({ id: "msg_ok" }, { status: 200 })
          : new Response("rate limited", { status: 429 });
      })
    );

    const result = await sendCampaign(campaignId);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);

    const campaign = row<{ status: string; stats: string }>(
      "SELECT status, stats FROM email_campaigns WHERE id = ?",
      campaignId
    );
    // Regression guard: this used to be recorded as a clean "sent".
    expect(campaign?.status).toBe("partial");
    expect(JSON.parse(campaign!.stats)).toMatchObject({ sent: 1, failed: 1 });
  });

  it("marks the campaign failed when nothing is delivered", async () => {
    seedContact("f1@example.com", 1);
    const campaignId = seedCampaign("AllFail");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));

    const result = await sendCampaign(campaignId);
    expect(result.sent).toBe(0);
    expect(result.failed).toBeGreaterThan(0);

    const campaign = row<{ status: string }>("SELECT status FROM email_campaigns WHERE id = ?", campaignId);
    expect(campaign?.status).toBe("failed");
  });

  it("records the provider error against the recipient send row", async () => {
    seedContact("e1@example.com", 1);
    const campaignId = seedCampaign("Errors");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad key", { status: 401 })));

    await sendCampaign(campaignId);

    const send = row<{ status: string; error: string }>(
      "SELECT status, error FROM email_sends WHERE campaign_id = ?",
      campaignId
    );
    expect(send?.status).toBe("failed");
    expect(send?.error).toContain("resend rejected");
  });

  it("does not record a send row at all when no provider is configured in production", async () => {
    seedContact("n1@example.com", 1);
    const campaignId = seedCampaign("NoProvider");
    vi.stubEnv("EMAIL_PROVIDER", undefined);

    const result = await sendCampaign(campaignId);

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    const send = row<{ status: string }>("SELECT status FROM email_sends WHERE campaign_id = ?", campaignId);
    expect(send?.status).toBe("failed");
    const campaign = row<{ status: string }>("SELECT status FROM email_campaigns WHERE id = ?", campaignId);
    expect(campaign?.status).toBe("failed");
  });

  it("marks the campaign sent only when every recipient is delivered", async () => {
    seedContact("s1@example.com", 1);
    const campaignId = seedCampaign("AllGood");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "msg_ok" }, { status: 200 })));

    const result = await sendCampaign(campaignId);
    expect(result.failed).toBe(0);
    const campaign = row<{ status: string }>("SELECT status FROM email_campaigns WHERE id = ?", campaignId);
    expect(campaign?.status).toBe("sent");
  });
});