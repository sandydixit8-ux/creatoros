import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { getDb, closeDb, run, nowIso } from "@/lib/db/db";

const sendEmail = vi.fn();
vi.mock("@/lib/email/mailer", () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

const { enqueueEmail } = await import("@/lib/email/jobs");
const { GET, POST } = await import("@/app/api/cron/email/route");

let dir: string;
const TENANT = "org_cron_email_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-cron-email-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Cron', 'cron-email-org', 'free', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM email_jobs");
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ provider: "resend", providerId: "prov_cron" });
  process.env.CRON_SECRET = "cron_secret_test";
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { method: "GET", headers });
}

const base = {
  tenantId: TENANT,
  to: "creator@example.com",
  subject: "Queued",
  html: "<p>Queued</p>",
  template: "cron_test",
};

describe("cron email drain", () => {
  it("refuses an unauthenticated call even when jobs are due", async () => {
    enqueueEmail({ ...base, idempotencyKey: "cron-unauth" });
    const res = await GET(req("https://usecreatoros.co/api/cron/email"));
    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    const res = await GET(
      req("https://usecreatoros.co/api/cron/email", { authorization: "Bearer wrong_secret" })
    );
    expect(res.status).toBe(403);
  });

  it("drains due jobs with a bearer secret", async () => {
    enqueueEmail({ ...base, idempotencyKey: "cron-auth" });
    const res = await POST(
      req("https://usecreatoros.co/api/cron/email?limit=5", { authorization: "Bearer cron_secret_test" })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ attempted: 1, sent: 1, retrying: 0, dead: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("accepts the secret as a query parameter for schedulers that cannot set headers", async () => {
    enqueueEmail({ ...base, idempotencyKey: "cron-query" });
    const res = await GET(req("https://usecreatoros.co/api/cron/email?secret=cron_secret_test"));
    expect(res.status).toBe(200);
    expect((await res.json()).data.sent).toBe(1);
  });
});
