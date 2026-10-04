import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { getDb, closeDb, run, row, newId, nowIso } from "@/lib/db/db";
import { POST as webhook } from "@/app/api/webhooks/stripe/route";
import { claimWebhookEvent, markWebhookProcessed, markWebhookFailed } from "@/lib/payments/webhook-events";
import { createOrderForProduct, attachCheckoutSession } from "@/lib/store/orders";

/**
 * D-11: a webhook is a promise that money moved. The route used to write the
 * `webhook_events` row with `processed_at` already set *before* doing the work,
 * then returned 200 even when the work threw. That combination made a transient
 * failure permanent:
 *
 *   - the event was on file as processed, so a gateway retry matched the
 *     duplicate check and returned early without re-running anything;
 *   - the 200 told the gateway the delivery succeeded, so it stopped retrying.
 *
 * A paid order whose enrolment insert failed once stayed `pending` for ever, and
 * the gateway would not send it again. Nobody was paged, because nothing looked
 * wrong from the outside.
 */

let dir: string;
const TENANT = "org_d11";
const EMAIL = "buyer@example.com";

function seedCourse(): string {
  const id = newId("crs");
  run(
    "INSERT INTO courses (id, tenant_id, title, slug, description, price_cents, currency, published, created_at, updated_at) VALUES (?, ?, 'Course', ?, 'Body', 0, 'usd', 1, ?, ?)",
    id,
    TENANT,
    `course-${id.slice(4, 12)}`,
    nowIso(),
    nowIso()
  );
  return id;
}

/** A pending order for a course, so fulfilment has to create an enrolment. */
function seedCourseOrder(): { orderId: string; sessionId: string } {
  const courseId = seedCourse();
  const productId = newId("prd");
  run(
    "INSERT INTO products (id, tenant_id, name, description, price_cents, currency, kind, active, created_at, updated_at) VALUES (?, ?, 'Course access', 'Body', 2500, 'usd', 'digital', 1, ?, ?)",
    productId,
    TENANT,
    nowIso(),
    nowIso()
  );
  const order = createOrderForProduct(
    {
      id: productId,
      tenant_id: TENANT,
      page_id: null,
      name: "Course access",
      description: "",
      price_cents: 2500,
      currency: "usd",
      kind: "digital",
      media_url: "",
      active: 1,
    },
    { email: EMAIL }
  );
  run("UPDATE orders SET course_id = ? WHERE id = ?", courseId, order.id);
  const sessionId = `sess_${order.id}`;
  attachCheckoutSession(order.id, "mock", sessionId);
  return { orderId: order.id, sessionId };
}

function post(body: unknown): Promise<Response> {
  return webhook(
    new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify(body),
    })
  ) as Promise<Response>;
}

function completed(sessionId: string, eventId: string) {
  return post({ id: eventId, type: "checkout.session.completed", data: { id: sessionId } });
}

function orderStatus(orderId: string): string {
  return String(row<{ status: string }>("SELECT status FROM orders WHERE id = ?", orderId)?.status ?? "");
}

function eventRow(eventId: string): { status: string; processed_at: string; attempts: number } | undefined {
  return row("SELECT status, processed_at, attempts FROM webhook_events WHERE id = ?", eventId);
}

/** Drop a table and hand back the SQL needed to put it back. */
function dropTable(name: string): string {
  const sql = String(row<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?", name)?.sql ?? "");
  run(`DROP TABLE ${name}`);
  return sql;
}

function tableExists(name: string): boolean {
  return Boolean(row("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", name));
}

let enrollmentsSql = "";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-d11-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  process.env.PAYMENT_PROVIDER = "mock";
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "d11-secret-with-enough-entropy-1234";
  getDb();
  enrollmentsSql = String(row<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type='table' AND name = 'enrollments'")?.sql ?? "");
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'D11', 'd11', 'creator', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
});

// Tests that force a fulfilment failure do it by dropping `enrollments`. Put it
// back unconditionally, so one test's sabotage cannot cascade into the next.
afterEach(() => {
  if (!tableExists("enrollments") && enrollmentsSql) run(enrollmentsSql);
});

beforeEach(() => {
  run("DELETE FROM webhook_events");
  run("DELETE FROM order_items");
  run("DELETE FROM orders");
  run("DELETE FROM payments");
  run("DELETE FROM enrollments");
  run("DELETE FROM contacts");
  run("DELETE FROM plans_usage");
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("webhook delivery handling", () => {
  it("fulfils the order and marks the event processed", async () => {
    const { orderId, sessionId } = seedCourseOrder();
    const res = await completed(sessionId, "evt_ok");

    expect(res.status).toBe(200);
    expect(orderStatus(orderId)).toBe("paid");
    expect(eventRow("evt_ok")?.status).toBe("processed");
  });

  it("records the event as received before touching the order", async () => {
    const { sessionId } = seedCourseOrder();
    const res = await completed(sessionId, "evt_received");

    expect(res.status).toBe(200);
    // The receipt is the audit trail a support agent needs when a customer says
    // "the gateway says it paid". Both timestamps are set once the work is done.
    const received = row<{ received_at: string; processed_at: string | null }>(
      "SELECT received_at, processed_at FROM webhook_events WHERE id = ?",
      "evt_received"
    );
    expect(received?.received_at).toBeTruthy();
    expect(received?.processed_at).toBeTruthy();
  });

  it("does not lose a paid order when fulfilment fails once", async () => {
    const { orderId, sessionId } = seedCourseOrder();
    const enrollmentsSql = dropTable("enrollments");

    const failed = await completed(sessionId, "evt_flaky");

    // Must not acknowledge: a 200 here is what stops the gateway retrying.
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(orderStatus(orderId)).toBe("pending");
    // And it must not be on file as done, or the retry below would be dropped
    // as a duplicate.
    expect(eventRow("evt_flaky")?.status).not.toBe("processed");

    run(enrollmentsSql);

    // The gateway retries the same event id.
    const retry = await completed(sessionId, "evt_flaky");

    expect(retry.status).toBe(200);
    expect(orderStatus(orderId)).toBe("paid");
    expect(eventRow("evt_flaky")?.status).toBe("processed");
  });

  it("counts each attempt at the event", async () => {
    const { sessionId } = seedCourseOrder();
    const enrollmentsSql = dropTable("enrollments");

    await completed(sessionId, "evt_attempts");
    const afterFirst = Number(eventRow("evt_attempts")?.attempts ?? 0);
    run(enrollmentsSql);
    await completed(sessionId, "evt_attempts");

    expect(afterFirst).toBeGreaterThanOrEqual(1);
    expect(Number(eventRow("evt_attempts")?.attempts ?? 0)).toBeGreaterThan(afterFirst);
  });

  it("keeps the failure reason for support to look at", async () => {
    const { sessionId } = seedCourseOrder();
    dropTable("enrollments");

    await completed(sessionId, "evt_reason");

    const stored = eventRow("evt_reason");
    expect(stored?.status).not.toBe("processed");
    const lastError = String(row<{ last_error: string }>("SELECT last_error FROM webhook_events WHERE id = ?", "evt_reason")?.last_error ?? "");
    expect(lastError).not.toBe("");
  });

  it("does no work twice for a redelivery of a processed event", async () => {
    const { orderId, sessionId } = seedCourseOrder();
    await completed(sessionId, "evt_dupe");

    const before = Number(eventRow("evt_dupe")?.attempts ?? 0);
    const res = await completed(sessionId, "evt_dupe");

    expect(res.status).toBe(200);
    expect(orderStatus(orderId)).toBe("paid");
    // Unchanged: a settled event is not re-run, which is what stops a duplicate
    // delivery double-charging or double-enrolling.
    expect(Number(eventRow("evt_dupe")?.attempts ?? 0)).toBe(before);
  });

  it("refuses an event with no verifiable signature", async () => {
    // The mock provider accepts any well-formed body, but an empty body is not
    // an event at all.
    const res = await post({ nope: true });

    expect(res.status).toBe(400);
  });
});

describe("claiming an event", () => {
  const incoming = { id: "evt_claim", provider: "mock", type: "checkout.session.completed", payload: { id: "s" } };

  it("lets exactly one of two simultaneous deliveries take the event", () => {
    const a = claimWebhookEvent(incoming);
    const b = claimWebhookEvent(incoming);

    const winners = [a, b].filter((c) => c.claimed);
    expect(winners).toHaveLength(1);
    // The loser backs off rather than running the work a second time.
    expect([a, b].find((c) => !c.claimed)?.claimed).toBe(false);
  });

  it("refuses to re-claim an event that is already being handled", () => {
    expect(claimWebhookEvent(incoming).claimed).toBe(true);

    const second = claimWebhookEvent(incoming);
    expect(second.claimed).toBe(false);
    if (!second.claimed) expect(second.reason).toBe("in_flight");
  });

  it("refuses to re-claim a settled event", () => {
    claimWebhookEvent(incoming);
    markWebhookProcessed("evt_claim");

    const again = claimWebhookEvent(incoming);
    expect(again.claimed).toBe(false);
    if (!again.claimed) expect(again.reason).toBe("already_processed");
  });

  it("reclaims an event abandoned by a worker that died mid-handler", () => {
    claimWebhookEvent(incoming);
    // Simulate a process killed after claiming: the row is still 'processing'.
    expect(eventRow("evt_claim")?.status).toBe("processing");

    // Age the claim past the lease.
    run(
      "UPDATE webhook_events SET updated_at = ? WHERE id = ?",
      new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      "evt_claim"
    );

    // Without this, fixing the duplicate-suppression bug would have introduced a
    // new way for an event to be stuck for ever.
    const reclaimed = claimWebhookEvent(incoming);
    expect(reclaimed.claimed).toBe(true);
    expect(reclaimed.claimed && reclaimed.attempts).toBe(2);
  });

  it("clears the stored error when a retry starts", () => {
    claimWebhookEvent(incoming);
    markWebhookFailed("evt_claim", new Error("gateway timeout"));
    expect(String(row<{ last_error: string }>("SELECT last_error FROM webhook_events WHERE id = ?", "evt_claim")?.last_error)).toContain("gateway timeout");

    claimWebhookEvent(incoming);
    const after = row<{ last_error: string | null; status: string }>(
      "SELECT last_error, status FROM webhook_events WHERE id = ?",
      "evt_claim"
    );
    expect(after?.last_error).toBeNull();
    expect(after?.status).toBe("processing");
  });
});