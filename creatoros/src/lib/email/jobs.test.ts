import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, nowIso } from "@/lib/db/db";

const sendEmail = vi.fn();
vi.mock("@/lib/email/mailer", () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

const { enqueueEmail, runEmailJobs, backoffSeconds, recentEmailJobs } = await import("./jobs");

let dir: string;
const TENANT = "org_email_jobs_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-email-jobs-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Jobs', 'jobs-org', 'free', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM email_jobs");
  run("DELETE FROM unsubscribes WHERE tenant_id = ?", TENANT);
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ provider: "resend", providerId: "prov_1" });
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const base = {
  tenantId: TENANT,
  to: "creator@example.com",
  subject: "Hello",
  html: "<p>Hello</p>",
  template: "test",
};

function jobCount(): number {
  return Number(row<{ c: number }>("SELECT COUNT(*) AS c FROM email_jobs")?.c ?? 0);
}

describe("email job queue", () => {
  it("enqueues once per idempotency key", () => {
    expect(enqueueEmail({ ...base, idempotencyKey: "k1" })).toEqual({ enqueued: true, reason: "inserted" });
    expect(enqueueEmail({ ...base, idempotencyKey: "k1" })).toEqual({ enqueued: false, reason: "duplicate" });
    expect(jobCount()).toBe(1);
  });

  it("suppresses marketing for an unsubscribed address but still sends transactional mail", () => {
    run(
      "INSERT INTO unsubscribes (id, tenant_id, email, reason, created_at) VALUES ('u1', ?, 'creator@example.com', '', ?)",
      TENANT,
      nowIso()
    );
    expect(enqueueEmail({ ...base, idempotencyKey: "m1", kind: "marketing" })).toEqual({
      enqueued: false,
      reason: "suppressed",
    });
    expect(enqueueEmail({ ...base, idempotencyKey: "t1", kind: "transactional" })).toEqual({
      enqueued: true,
      reason: "inserted",
    });
  });

  it("sends a due job once and marks it sent", async () => {
    enqueueEmail({ ...base, idempotencyKey: "send-1" });
    const res = await runEmailJobs();
    expect(res).toEqual({ attempted: 1, sent: 1, retrying: 0, dead: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // A second drain must not re-send.
    const again = await runEmailJobs();
    expect(again.attempted).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(jobCount()).toBe(1);
    expect(row<{ status: string }>("SELECT status FROM email_jobs")?.status).toBe("sent");
  });

  it("does not send a job scheduled for the future", async () => {
    enqueueEmail({ ...base, idempotencyKey: "later", delayMs: 60_000 });
    const res = await runEmailJobs();
    expect(res.attempted).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("backs off after a failure and retries, then goes dead at the limit", async () => {
    enqueueEmail({ ...base, idempotencyKey: "retry-1", maxAttempts: 2 });
    sendEmail.mockRejectedValueOnce(new Error("provider down"));

    const first = await runEmailJobs();
    expect(first).toMatchObject({ attempted: 1, sent: 0, retrying: 1, dead: 0 });

    const afterFirst = row<{ status: string; attempts: number; next_attempt_at: string; last_error: string }>(
      "SELECT status, attempts, next_attempt_at, last_error FROM email_jobs"
    );
    expect(afterFirst?.status).toBe("queued");
    expect(afterFirst?.attempts).toBe(1);
    expect(afterFirst?.last_error).toContain("provider down");
    expect(new Date(afterFirst!.next_attempt_at).getTime()).toBeGreaterThan(Date.now());

    // Not due yet: nothing is attempted.
    expect((await runEmailJobs()).attempted).toBe(0);

    // Pretend the backoff elapsed.
    run("UPDATE email_jobs SET next_attempt_at = ?", nowIso());
    sendEmail.mockRejectedValueOnce(new Error("still down"));
    const second = await runEmailJobs();
    expect(second).toMatchObject({ attempted: 1, sent: 0, retrying: 0, dead: 1 });
    expect(row<{ status: string }>("SELECT status FROM email_jobs")?.status).toBe("dead");
  });

  it("never re-sends when two drains run at once", async () => {
    enqueueEmail({ ...base, idempotencyKey: "concurrent-1" });
    let release: (v: unknown) => void = () => {};
    sendEmail.mockImplementationOnce(
      () => new Promise((resolve) => {
        release = resolve;
      })
    );

    const a = runEmailJobs();
    const b = runEmailJobs();
    release({ provider: "resend", providerId: "prov_1" });
    await Promise.all([a, b]);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(row<{ status: string }>("SELECT status FROM email_jobs")?.status).toBe("sent");
  });

  it("caps backoff instead of growing without bound", () => {
    expect(backoffSeconds(0)).toBe(60);
    expect(backoffSeconds(1)).toBe(120);
    expect(backoffSeconds(2)).toBe(240);
    expect(backoffSeconds(3)).toBe(480);
    expect(backoffSeconds(10)).toBe(6 * 60 * 60);
    expect(backoffSeconds(99)).toBe(6 * 60 * 60);
  });

  it("exposes recent jobs for support without leaking the body", () => {
    enqueueEmail({ ...base, idempotencyKey: "ops-1" });
    const recent = recentEmailJobs(5);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toHaveProperty("template", "test");
    expect(recent[0]).not.toHaveProperty("html");
  });
});
