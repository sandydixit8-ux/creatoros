import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, all, row, tx, inTransaction, newId, nowIso } from "@/lib/db/db";
import { fulfillOrder, createOrderForProduct, attachCheckoutSession } from "@/lib/store/orders";

/**
 * D-10: money writes have to be all-or-nothing.
 *
 * The defect these guard against is not theoretical. Fulfilment used to flip an
 * order to `paid` and create the enrolment as two separate writes, so a failure
 * between them left a customer who had paid, shown as fulfilled, and unable to
 * open the course they bought - with the `already_paid` guard making every later
 * retry a no-op. Permanent, silent, and discovered by the customer.
 */

let dir: string;
const TENANT = "org_d10";
const USER = "usr_d10";
const EMAIL = "buyer@example.com";

function seedProduct(priceCents: number): string {
  const id = newId("prd");
  run(
    "INSERT INTO products (id, tenant_id, name, description, price_cents, currency, kind, active, created_at, updated_at) VALUES (?, ?, 'Thing', 'A thing', ?, 'usd', 'digital', 1, ?, ?)",
    id,
    TENANT,
    priceCents,
    nowIso(),
    nowIso()
  );
  return id;
}

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

/** A paid-looking order ready for fulfilment. */
function seedOrder(opts: { courseId?: string; price?: number } = {}): string {
  const productId = seedProduct(opts.price ?? 1000);
  const order = createOrderForProduct(
    { id: productId, tenant_id: TENANT, page_id: null, name: "Thing", description: "", price_cents: opts.price ?? 1000, currency: "usd", kind: "digital", media_url: "", active: 1 },
    { email: EMAIL }
  );
  attachCheckoutSession(order.id, "mock", `sess_${order.id}`);
  if (opts.courseId !== undefined) {
    run("UPDATE orders SET course_id = ? WHERE id = ?", opts.courseId, order.id);
  }
  return order.id;
}

function statusOf(orderId: string): string {
  return String(row<{ status: string }>("SELECT status FROM orders WHERE id = ?", orderId)?.status ?? "");
}

function refundedOf(orderId: string): number {
  return Number(row<{ refunded_cents: number }>("SELECT refunded_cents FROM orders WHERE id = ?", orderId)?.refunded_cents ?? 0);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-d10-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'D10', 'd10', 'creator', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, 'admin@example.com', 'h', 'Admin', 'user', ?, ?)",
    USER,
    nowIso(),
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM refunds");
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

describe("D-10: tx()", () => {
  it("commits when the body returns", () => {
    tx(() => {
      run("INSERT INTO contacts (id, tenant_id, email, name, consent, source, tags, created_at, updated_at) VALUES ('c1', ?, 'a@b.c', '', 0, 'test', '[]', ?, ?)", TENANT, nowIso(), nowIso());
    });
    expect(all("SELECT id FROM contacts WHERE id = 'c1'")).toHaveLength(1);
  });

  it("rolls back every write when the body throws", () => {
    expect(() =>
      tx(() => {
        run("INSERT INTO contacts (id, tenant_id, email, name, consent, source, tags, created_at, updated_at) VALUES ('c2', ?, 'x@y.z', '', 0, 'test', '[]', ?, ?)", TENANT, nowIso(), nowIso());
        throw new Error("boom");
      })
    ).toThrow("boom");

    expect(all("SELECT id FROM contacts WHERE id = 'c2'")).toHaveLength(0);
  });

  it("lets an inner tx join the outer one so an inner failure aborts everything", () => {
    expect(() =>
      tx(() => {
        run("INSERT INTO contacts (id, tenant_id, email, name, consent, source, tags, created_at, updated_at) VALUES ('c3', ?, 'in@ner.co', '', 0, 'test', '[]', ?, ?)", TENANT, nowIso(), nowIso());
        expect(inTransaction()).toBe(true);
        tx(() => {
          throw new Error("inner failed");
        });
      })
    ).toThrow("inner failed");

    expect(all("SELECT id FROM contacts WHERE id = 'c3'")).toHaveLength(0);
  });

  it("reports no open transaction once it finishes", () => {
    tx(() => {
      expect(inTransaction()).toBe(true);
    });
    expect(inTransaction()).toBe(false);
  });

  it("clears the transaction state after a rollback so later work still commits", () => {
    expect(() =>
      tx(() => {
        throw new Error("first fails");
      })
    ).toThrow();
    expect(inTransaction()).toBe(false);

    tx(() => {
      run("INSERT INTO contacts (id, tenant_id, email, name, consent, source, tags, created_at, updated_at) VALUES ('c4', ?, 'after@roll.back', '', 0, 'test', '[]', ?, ?)", TENANT, nowIso(), nowIso());
    });
    expect(all("SELECT id FROM contacts WHERE id = 'c4'")).toHaveLength(1);
  });
});

describe("D-10: fulfilOrder is atomic", () => {
  it("fulfils a plain order and marks the payment succeeded", () => {
    const orderId = seedOrder();
    expect(fulfillOrder(orderId)).toBe("paid");
    expect(statusOf(orderId)).toBe("paid");
    expect(
      row<{ status: string }>("SELECT status FROM payments WHERE order_id = ?", orderId)?.status
    ).toBe("succeeded");
  });

  it("creates the enrolment when the order is for a course", () => {
    const courseId = seedCourse();
    const orderId = seedOrder({ courseId });

    expect(fulfillOrder(orderId)).toBe("paid");
    const enr = all("SELECT id FROM enrollments WHERE order_id = ?", orderId);
    expect(enr).toHaveLength(1);
  });

  it("is idempotent: a second call does not enrol or count twice", () => {
    const courseId = seedCourse();
    const orderId = seedOrder({ courseId });

    expect(fulfillOrder(orderId)).toBe("paid");
    expect(fulfillOrder(orderId)).toBe("already_paid");

    expect(all("SELECT id FROM enrollments WHERE order_id = ?", orderId)).toHaveLength(1);
  });

  it("rolls the whole thing back when enrolment fails, leaving the order retryable", () => {
    // course_id points at a course that does not exist, so the enrolment insert
    // violates the foreign key. This is the exact shape of the original bug: the
    // failure happened *after* the order was already marked paid.
    const orderId = seedOrder({ courseId: "crs_does_not_exist" });

    expect(() => fulfillOrder(orderId)).toThrow();

    // The important assertions: not paid, no orphan payment, and - crucially -
    // still pending, so a later attempt can succeed once the data is fixed.
    expect(statusOf(orderId)).toBe("pending");
    expect(row<{ status: string }>("SELECT status FROM payments WHERE order_id = ?", orderId)?.status).toBe("pending");

    run("UPDATE orders SET course_id = '' WHERE id = ?", orderId);
    expect(fulfillOrder(orderId)).toBe("paid");
    expect(statusOf(orderId)).toBe("paid");
  });

  it("does not count a sale for an order it could not fulfil", () => {
    const orderId = seedOrder({ courseId: "crs_missing" });
    expect(() => fulfillOrder(orderId)).toThrow();
    expect(all("SELECT * FROM plans_usage WHERE tenant_id = ? AND metric = 'sales'", TENANT)).toHaveLength(0);
  });

  it("refuses unknown orders and non-pending ones", () => {
    expect(fulfillOrder("ord_nope")).toBe("not_found");

    const orderId = seedOrder();
    run("UPDATE orders SET status = 'canceled' WHERE id = ?", orderId);
    expect(fulfillOrder(orderId)).toBe("not_payable");
  });
});

describe("D-10: refund intents", () => {
  /** Insert a paid order directly; fulfilment noise is not what is under test. */
  function seedPaidOrder(amountCents = 1000): string {
    const orderId = newId("ord");
    run(
      `INSERT INTO orders (id, tenant_id, contact_id, email, status, amount_cents, currency, provider, provider_session_id, token, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 'paid', ?, 'usd', 'mock', ?, ?, ?, ?)`,
      orderId,
      TENANT,
      EMAIL,
      amountCents,
      `sess_${orderId}`,
      `tok_${orderId}`,
      nowIso(),
      nowIso()
    );
    run(
      "INSERT INTO payments (id, tenant_id, provider, provider_id, amount_cents, currency, status, order_id, created_at) VALUES (?, ?, 'mock', ?, ?, 'usd', 'succeeded', ?, ?)",
      newId("pay"),
      TENANT,
      `sess_${orderId}`,
      amountCents,
      orderId,
      nowIso()
    );
    return orderId;
  }

  it("records a pending intent before any money moves", () => {
    const orderId = seedPaidOrder();
    tx(() => {
      run(
        "INSERT INTO refunds (id, tenant_id, order_id, amount_cents, currency, provider, status, reason, admin_email, created_at, updated_at) VALUES ('ref_1', ?, ?, 500, 'usd', 'mock', 'pending', 'test', 'a@b.c', ?, ?)",
        TENANT,
        orderId,
        nowIso(),
        nowIso()
      );
    });

    const r = row<{ status: string; amount_cents: number }>(
      "SELECT status, amount_cents FROM refunds WHERE id = 'ref_1'"
    );
    expect(r?.status).toBe("pending");
    expect(r?.amount_cents).toBe(500);
    // The ledger has not moved yet - the intent alone is not a refund.
    expect(refundedOf(orderId)).toBe(0);
  });

  it("refuses a second in-flight refund for the same order", () => {
    const orderId = seedPaidOrder();
    const insert = () =>
      tx(() => {
        run(
          "INSERT INTO refunds (id, tenant_id, order_id, amount_cents, currency, provider, status, reason, admin_email, created_at, updated_at) VALUES (?, ?, ?, 500, 'usd', 'mock', 'pending', 'test', 'a@b.c', ?, ?)",
          newId("ref"),
          TENANT,
          orderId,
          nowIso(),
          nowIso()
        );
      });

    insert();
    expect(insert).toThrow(); // partial unique index rejects the second
    expect(all("SELECT id FROM refunds WHERE order_id = ? AND status = 'pending'", orderId)).toHaveLength(1);
  });

  it("allows a new refund once the previous one resolved", () => {
    const orderId = seedPaidOrder();
    run(
      "INSERT INTO refunds (id, tenant_id, order_id, amount_cents, currency, provider, status, reason, admin_email, created_at, updated_at) VALUES ('ref_done', ?, ?, 500, 'usd', 'mock', 'failed', 'test', 'a@b.c', ?, ?)",
      TENANT,
      orderId,
      nowIso(),
      nowIso()
    );
    expect(() =>
      tx(() => {
        run(
          "INSERT INTO refunds (id, tenant_id, order_id, amount_cents, currency, provider, status, reason, admin_email, created_at, updated_at) VALUES ('ref_next', ?, ?, 500, 'usd', 'mock', 'pending', 'test', 'a@b.c', ?, ?)",
          TENANT,
          orderId,
          nowIso(),
          nowIso()
        );
      })
    ).not.toThrow();
  });

  it("applies the refund, the order status and the payment together", () => {
    const orderId = seedPaidOrder(1000);
    const intentId = newId("ref");
    tx(() => {
      run(
        "INSERT INTO refunds (id, tenant_id, order_id, amount_cents, currency, provider, status, reason, admin_email, created_at, updated_at) VALUES (?, ?, ?, 1000, 'usd', 'mock', 'pending', 'test', 'a@b.c', ?, ?)",
        intentId,
        TENANT,
        orderId,
        nowIso(),
        nowIso()
      );
      run("UPDATE refunds SET status = 'succeeded', provider_refund_id = 'pr_1' WHERE id = ?", intentId);
      run("UPDATE orders SET refunded_cents = 1000, status = 'refunded' WHERE id = ?", orderId);
      run("UPDATE payments SET status = 'refunded' WHERE order_id = ?", orderId);
    });

    expect(refundedOf(orderId)).toBe(1000);
    expect(statusOf(orderId)).toBe("refunded");
    expect(row<{ status: string }>("SELECT status FROM payments WHERE order_id = ?", orderId)?.status).toBe("refunded");
  });

  it("leaves a partial refund still 'paid' and does not mark the payment refunded", () => {
    const orderId = seedPaidOrder(1000);
    tx(() => {
      run("UPDATE orders SET refunded_cents = 400 WHERE id = ?", orderId);
    });
    expect(statusOf(orderId)).toBe("paid");
    expect(refundedOf(orderId)).toBe(400);
    expect(row<{ status: string }>("SELECT status FROM payments WHERE order_id = ?", orderId)?.status).toBe("succeeded");
  });

  it("rolls the ledger back if the commit phase throws, keeping the intent pending", () => {
    const orderId = seedPaidOrder(1000);
    const intentId = newId("ref");
    run(
      "INSERT INTO refunds (id, tenant_id, order_id, amount_cents, currency, provider, status, reason, admin_email, created_at, updated_at) VALUES (?, ?, ?, 1000, 'usd', 'mock', 'pending', 'test', 'a@b.c', ?, ?)",
      intentId,
      TENANT,
      orderId,
      nowIso(),
      nowIso()
    );

    expect(() =>
      tx(() => {
        run("UPDATE refunds SET status = 'succeeded' WHERE id = ?", intentId);
        run("UPDATE orders SET refunded_cents = 1000, status = 'refunded' WHERE id = ?", orderId);
        throw new Error("db died mid-commit");
      })
    ).toThrow();

    // Ledger untouched, and the pending intent still blocks a blind retry -
    // which is exactly what stops a second refund going out.
    expect(refundedOf(orderId)).toBe(0);
    expect(statusOf(orderId)).toBe("paid");
    expect(row<{ status: string }>("SELECT status FROM refunds WHERE id = ?", intentId)?.status).toBe("pending");
  });
});